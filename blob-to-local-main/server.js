import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist')); // Serve built frontend

// Check if yt-dlp is installed
function checkYtDlp() {
  return new Promise((resolve) => {
    const ytDlp = spawn('yt-dlp', ['--version']);
    ytDlp.on('close', (code) => {
      resolve(code === 0);
    });
    ytDlp.on('error', () => {
      resolve(false);
    });
  });
}

// Download endpoint
app.post('/api/download-youtube', async (req, res) => {
  const { url, filename } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Check if yt-dlp is available
  const ytDlpAvailable = await checkYtDlp();
  if (!ytDlpAvailable) {
    return res.status(500).json({ 
      error: 'yt-dlp is not installed. Please install it with: pip install yt-dlp' 
    });
  }

  try {
    // Create a temporary directory for downloads
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-'));
    const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
    
    console.log(`Downloading: ${url}`);
    
    const ytDlp = spawn('yt-dlp', [
      '--format', 'best[ext=mp4]/best',
      '--output', outputTemplate,
      '--no-playlist',
      '--restrict-filenames', // Use safe filenames
      url
    ]);
    
    let stderr = '';
    let stdout = '';
    
    ytDlp.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });
    
    ytDlp.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });
    
    ytDlp.on('close', (code) => {
      if (code === 0) {
        // Find the downloaded file
        const files = fs.readdirSync(tempDir);
        if (files.length > 0) {
          const downloadedFile = path.join(tempDir, files[0]);
          const stats = fs.statSync(downloadedFile);
          
          // Send file as download
          const finalFilename = filename || files[0];
          res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Length', stats.size);
          
          const fileStream = fs.createReadStream(downloadedFile);
          fileStream.pipe(res);
          
          // Clean up after sending
          fileStream.on('end', () => {
            fs.rmSync(tempDir, { recursive: true, force: true });
          });
          
          fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            fs.rmSync(tempDir, { recursive: true, force: true });
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to send file' });
            }
          });
        } else {
          fs.rmSync(tempDir, { recursive: true, force: true });
          res.status(500).json({ error: 'No file was downloaded' });
        }
      } else {
        fs.rmSync(tempDir, { recursive: true, force: true });
        res.status(500).json({ 
          error: `yt-dlp failed with code ${code}`,
          details: stderr || stdout
        });
      }
    });
    
    ytDlp.on('error', (error) => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      res.status(500).json({ 
        error: 'Failed to start yt-dlp',
        details: error.message 
      });
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const ytDlpAvailable = await checkYtDlp();
  res.json({ 
    status: 'ok',
    ytDlpAvailable,
    message: ytDlpAvailable ? 'yt-dlp is available' : 'yt-dlp is not installed'
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at: http://localhost:${PORT}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
});