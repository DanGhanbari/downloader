import { saveAs } from 'file-saver';
import { MediaItem } from './MediaDetectionService';

export class DownloadService {
  static async downloadMedia(item: MediaItem): Promise<void> {
    try {
      // Handle different types of media downloads
      if (item.type === 'video' && item.url.includes('blob:')) {
        await this.downloadBlobVideo(item);
      } else if (item.url.includes('youtube.com') || item.url.includes('youtu.be') || item.url.includes('vimeo.com')) {
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
      console.log('Downloading from URL:', item.url);
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(item.url)}`;
      const response = await fetch(proxyUrl);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('Downloaded blob size:', blob.size, 'bytes');
      console.log('Downloaded blob type:', blob.type);
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
    console.log('Downloading embedded video:', item.url);
    
    // Handle YouTube URLs specially
    if (item.url.includes('youtube.com') || item.url.includes('youtu.be')) {
      const videoId = this.extractYouTubeId(item.url);
      console.log('YouTube video ID extracted:', videoId);
      console.log('Original YouTube URL:', item.url);
      
      try {
        // Try multiple YouTube download services
        await this.downloadYouTubeVideo(item, videoId);
        return;
      } catch (error) {
        console.error('YouTube download failed:', error);
        throw new Error('Failed to download YouTube video');
      }
    }

    // For non-YouTube embedded videos, try direct download first
    try {
      await this.downloadDirectMedia(item);
    } catch (error) {
      console.error('Direct download failed:', error);
      throw new Error('Failed to download embedded video');
    }
  }
  


  private static async downloadYouTubeVideo(item: MediaItem, videoId: string): Promise<void> {
    const downloadServices = [
      // Service 1: Try local yt-dlp backend (most reliable)
      async () => {
        const response = await fetch('/api/download-youtube', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: item.url,
            filename: item.filename
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Backend download failed: ${errorData.error || response.statusText}`);
        }
        
        // Get the file as a blob and save it
        const blob = await response.blob();
        saveAs(blob, item.filename);
        return;
      },
      
      // Service 2: Fallback to youtube-mp4-downloader.vercel.app
      async () => {
        const response = await fetch(`https://youtube-mp4-downloader.vercel.app/api/download?url=${encodeURIComponent(item.url)}`);
        if (!response.ok) throw new Error(`Service failed: ${response.status}`);
        const result = await response.json();
        if (result.downloadUrl) {
          const videoResponse = await fetch(result.downloadUrl);
          if (!videoResponse.ok) throw new Error('Failed to download video file');
          const blob = await videoResponse.blob();
          saveAs(blob, item.filename);
          return;
        }
        throw new Error('No download URL provided');
      },
      
      // Service 3: Fallback to alternative API
      async () => {
        const response = await fetch(`https://api.vevioz.com/api/button/mp4/mp4-720?url=${encodeURIComponent(item.url)}`);
        if (!response.ok) throw new Error(`Service failed: ${response.status}`);
        const result = await response.json();
        if (result.url) {
          const videoResponse = await fetch(result.url);
          if (!videoResponse.ok) throw new Error('Failed to download video file');
          const blob = await videoResponse.blob();
          saveAs(blob, item.filename);
          return;
        }
        throw new Error('No download URL provided');
      }
    ];

    let lastError: Error | null = null;
    
    for (let i = 0; i < downloadServices.length; i++) {
      try {
        console.log(`Trying YouTube download service ${i + 1}...`);
        await downloadServices[i]();
        console.log(`Successfully downloaded via service ${i + 1}`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.log(`Service ${i + 1} failed:`, error);
      }
    }
    
    throw new Error(`All YouTube download services failed. To use yt-dlp backend, please install yt-dlp (pip install yt-dlp) and run the server with 'npm run dev:full'. Last error: ${lastError?.message}`);
  }

  private static createDownloadLink(url: string, filename: string): void {
    try {
      // Create a temporary download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to create download link:', error);
      // Fallback: open URL in new tab
      window.open(url, '_blank');
    }
  }
  
  private static extractYouTubeId(url: string): string {
    console.log('Attempting to extract YouTube ID from:', url);
    
    // Clean URL by removing fragments and the '?si=' parameter
    const cleanUrl = url.split('#')[0].split('?si=')[0];
    
    // Extract YouTube video ID from various URL formats
    const patterns = [
      // Standard URL patterns
      /youtu\.be\/([^/]+)/,
      /youtube\.com\/watch\?v=([^/&]+)/,
      /youtube\.com\/embed\/([^/]+)/,
      /youtube\.com\/v\/([^/]+)/,
      
      // Shortened URL patterns
      /youtube\.com\/shorts\/([^/]+)/,
      
      // With additional parameters
      /youtube\.com\/watch\?.*v=([^/&]+)/,
      
      // Mobile URLs
      /m\.youtube\.com\/watch\?v=([^/&]+)/,
      
      // Embedded URLs
      /youtube\.com\/embed\/([^/]+)/,
      /youtube-nocookie\.com\/embed\/([^/]+)/,
      
      // Live stream URLs
      /youtube\.com\/live\/([^/]+)/,
      
      // Channel URLs with video ID
      /youtube\.com\/c\/[^/]+\/videos\/([^/]+)/
    ];
    
    // Try each pattern until we find a match
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      console.log('Trying pattern:', pattern, 'Match:', match);
      if (match && match[1] && (match[1].length === 11 || match[1].length === 10)) {
        console.log('Found video ID:', match[1]);
        return match[1];
      }
    }
    
    // Fallback to original pattern
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/videos\/|\/embed\/|\/v\/|\/e\/|watch\?v=|\?v=|&v=|embed\?v=|\/v\/|\/e\/|watch\?v=|\?v=|&v=)([^#&?]*).*/;
    const fallbackMatch = cleanUrl.match(regExp);
    console.log('Fallback match:', fallbackMatch);
    
    const result = (fallbackMatch && fallbackMatch[2] && (fallbackMatch[2].length === 11 || fallbackMatch[2].length === 10)) ? fallbackMatch[2] : '';
    console.log('Final result:', result);
    
    if (!result) {
      throw new Error(`Could not extract YouTube ID from URL: ${url}`);
    }
    
    return result;
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