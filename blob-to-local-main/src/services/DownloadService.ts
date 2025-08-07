import { saveAs } from 'file-saver';
import { MediaItem } from './MediaDetectionService';

export class DownloadService {
  static async downloadMedia(item: MediaItem): Promise<void> {
    try {
      // Handle different types of media downloads
      if (item.type === 'video' && item.url.includes('blob:')) {
        await this.downloadBlobVideo(item);
      } else if (item.url.includes('youtube.com') || item.url.includes('vimeo.com')) {
        await this.downloadEmbeddedVideo(item);
      } else {
        await this.downloadDirectMedia(item);
      }
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error(`Failed to download ${item.filename}`);
    }
  }

  private static async downloadDirectMedia(item: MediaItem): Promise<void> {
    try {
      // Use CORS proxy for cross-origin downloads
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(item.url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      saveAs(blob, item.filename);
    } catch (error) {
      // Fallback: try direct download (might fail due to CORS)
      try {
        const response = await fetch(item.url, { mode: 'no-cors' });
        const blob = await response.blob();
        saveAs(blob, item.filename);
      } catch (fallbackError) {
        // Last resort: create a download link
        this.createDownloadLink(item.url, item.filename);
      }
    }
  }

  private static async downloadBlobVideo(item: MediaItem): Promise<void> {
    try {
      // For blob URLs, we need to fetch the blob data directly
      const response = await fetch(item.url);
      const blob = await response.blob();
      saveAs(blob, item.filename);
    } catch (error) {
      console.error('Failed to download blob video:', error);
      throw error;
    }
  }

  private static async downloadEmbeddedVideo(item: MediaItem): Promise<void> {
    // For embedded videos (YouTube, Vimeo), we can't directly download
    // Instead, we'll open the video in a new tab with instructions
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Video Download Instructions</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
              .video-frame { border: 1px solid #ccc; margin: 20px 0; }
              .instructions { background: #f5f5f5; padding: 15px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <h2>Video Download Instructions</h2>
            <p>This video is embedded from an external platform. To download it, you can:</p>
            <div class="instructions">
              <h3>Option 1: Use a video downloader</h3>
              <p>• Visit <a href="https://yt-dlp.org/" target="_blank">yt-dlp.org</a> for command-line tool</p>
              <p>• Or use online tools like <a href="https://savefrom.net/" target="_blank">SaveFrom.net</a></p>
              
              <h3>Option 2: Browser extensions</h3>
              <p>• Install a video downloader extension for your browser</p>
              
              <h3>Original Video URL:</h3>
              <p><a href="${item.url}" target="_blank">${item.url}</a></p>
            </div>
            
            <iframe src="${item.url}" width="560" height="315" class="video-frame"></iframe>
          </body>
        </html>
      `);
    } else {
      // If popup is blocked, just open the URL
      window.open(item.url, '_blank');
    }
  }

  private static createDownloadLink(url: string, filename: string): void {
    // Create a temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static async downloadAll(items: MediaItem[]): Promise<void> {
    const downloadPromises = items.map(item => this.downloadMedia(item));
    
    try {
      await Promise.allSettled(downloadPromises);
    } catch (error) {
      console.error('Bulk download failed:', error);
      throw error;
    }
  }

  static async downloadWithFFmpeg(item: MediaItem): Promise<void> {
    // Note: FFmpeg integration would require a backend service or WebAssembly version
    // For now, we'll show instructions for manual FFmpeg usage
    
    const ffmpegInstructions = `
      To download this media with FFmpeg, use the following command:
      
      ffmpeg -i "${item.url}" -c copy "${item.filename}"
      
      For blob videos or complex streams, you might need:
      ffmpeg -i "${item.url}" -c:v libx264 -c:a aac "${item.filename}"
    `;
    
    console.log(ffmpegInstructions);
    
    // For demo purposes, fall back to regular download
    await this.downloadDirectMedia(item);
  }
}