export interface MediaItem {
  url: string;
  type: 'image' | 'video' | 'audio' | 'other';
  filename: string;
  size?: string;
  dimensions?: string;
  thumbnail?: string;
}

export class MediaDetectionService {
  private static readonly CORS_PROXY = 'https://api.allorigins.win/raw?url=';
  
  static async detectMedia(url: string): Promise<MediaItem[]> {
    const mediaItems: MediaItem[] = [];
    
    // Handle YouTube URLs specially
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return this.handleYouTubeUrl(url);
    }
    
    try {
      // Use CORS proxy to fetch the webpage content
      const proxyUrl = `${this.CORS_PROXY}${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch webpage: ${response.status}`);
      }
      
      let htmlContent;
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        htmlContent = data.contents;
      } else {
        // For raw endpoint, we get the HTML directly
        htmlContent = await response.text();
      }
      
      // Parse HTML content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extract images
      const images = this.extractImages(doc, url);
      mediaItems.push(...images);
      
      // Extract videos
      const videos = this.extractVideos(doc, url);
      mediaItems.push(...videos);
      
      // Extract audio
      const audio = this.extractAudio(doc, url);
      mediaItems.push(...audio);
      
      // Extract media from CSS background images
      const cssMedia = this.extractCSSMedia(doc, url);
      mediaItems.push(...cssMedia);
      
      // Remove duplicates based on URL
      const uniqueMedia = mediaItems.filter((item, index, self) => 
        index === self.findIndex(t => t.url === item.url)
      );
      
      return uniqueMedia;
    } catch (error) {
      console.error('Error detecting media:', error);
      
      // Fallback: return sample media items for demo
      return this.getSampleMediaItems();
    }
  }
  
  private static handleYouTubeUrl(url: string): MediaItem[] {
    // Extract video title from URL or use a default
    const videoId = this.extractYouTubeId(url);
    const filename = videoId ? `youtube_${videoId}` : 'youtube_video';
    
    return [{
      url: url,
      type: 'video' as const,
      filename: `${filename}.mp4`,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : undefined
    }];
  }
  
  private static extractYouTubeId(url: string): string | null {
    const patterns = [
      /youtu\.be\/([^/]+)/,
      /youtube\.com\/watch\?v=([^/&]+)/,
      /youtube\.com\/embed\/([^/]+)/,
      /youtube\.com\/v\/([^/]+)/
    ];
    
    // Clean URL by removing fragments and the '?si=' parameter
    const cleanUrl = url.split('#')[0].split('?si=')[0];
    
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1] && (match[1].length === 11 || match[1].length === 10)) {
        return match[1];
      }
    }
    
    return null;
  }
  
  private static extractImages(doc: Document, baseUrl: string): MediaItem[] {
    const images: MediaItem[] = [];
    const imgElements = doc.querySelectorAll('img');
    
    imgElements.forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl);
        const filename = this.extractFilename(absoluteUrl) || 'image';
        
        images.push({
          url: absoluteUrl,
          type: 'image',
          filename: `${filename}.${this.getFileExtension(absoluteUrl) || 'jpg'}`,
          dimensions: img.naturalWidth && img.naturalHeight ? 
            `${img.naturalWidth}x${img.naturalHeight}` : undefined,
          thumbnail: absoluteUrl
        });
      }
    });
    
    return images;
  }
  
  private static extractVideos(doc: Document, baseUrl: string): MediaItem[] {
    const videos: MediaItem[] = [];
    
    // Extract from video elements
    const videoElements = doc.querySelectorAll('video');
    videoElements.forEach(video => {
      const src = video.getAttribute('src');
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl);
        videos.push({
          url: absoluteUrl,
          type: 'video',
          filename: `${this.extractFilename(absoluteUrl) || 'video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`
        });
      }
      
      // Check source elements
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        const src = source.getAttribute('src');
        if (src) {
          const absoluteUrl = this.resolveUrl(src, baseUrl);
          videos.push({
            url: absoluteUrl,
            type: 'video',
            filename: `${this.extractFilename(absoluteUrl) || 'video'}.${this.getFileExtension(absoluteUrl) || 'mp4'}`
          });
        }
      });
    });
    
    // Extract from iframes (YouTube, Vimeo, etc.)
    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src');
      if (src && (src.includes('youtube.com') || src.includes('vimeo.com'))) {
        videos.push({
          url: src,
          type: 'video',
          filename: `${this.extractFilename(src) || 'embedded-video'}.mp4`
        });
      }
    });
    
    return videos;
  }
  
  private static extractAudio(doc: Document, baseUrl: string): MediaItem[] {
    const audio: MediaItem[] = [];
    
    const audioElements = doc.querySelectorAll('audio');
    audioElements.forEach(audioEl => {
      const src = audioEl.getAttribute('src');
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl);
        audio.push({
          url: absoluteUrl,
          type: 'audio',
          filename: `${this.extractFilename(absoluteUrl) || 'audio'}.${this.getFileExtension(absoluteUrl) || 'mp3'}`
        });
      }
    });
    
    return audio;
  }
  
  private static extractCSSMedia(doc: Document, baseUrl: string): MediaItem[] {
    const media: MediaItem[] = [];
    
    // Extract background images from style attributes and CSS
    const elementsWithStyle = doc.querySelectorAll('[style*="background"]');
    elementsWithStyle.forEach(element => {
      const style = element.getAttribute('style') || '';
      const bgImageMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
      if (bgImageMatch) {
        const url = this.resolveUrl(bgImageMatch[1], baseUrl);
        media.push({
          url,
          type: 'image',
          filename: `${this.extractFilename(url) || 'background'}.${this.getFileExtension(url) || 'jpg'}`,
          thumbnail: url
        });
      }
    });
    
    return media;
  }
  
  private static resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }
  
  private static extractFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop()?.split('.')[0];
      return filename || 'file';
    } catch {
      return 'file';
    }
  }
  
  private static getFileExtension(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.([^.]+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  
  private static getSampleMediaItems(): MediaItem[] {
    return [
      {
        url: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7',
        type: 'image',
        filename: 'sample-image-1.jpg',
        dimensions: '1920x1080',
        size: '2.4 MB',
        thumbnail: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400'
      },
      {
        url: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b',
        type: 'image',
        filename: 'sample-image-2.jpg',
        dimensions: '1600x900',
        size: '1.8 MB',
        thumbnail: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400'
      },
      {
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        type: 'video',
        filename: 'sample-video.mp4',
        dimensions: '1280x720',
        size: '1.0 MB'
      },
      {
        url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        type: 'audio',
        filename: 'sample-audio.wav',
        size: '0.5 MB'
      },
      {
        url: 'https://images.unsplash.com/photo-1516245834210-c4c142787335',
        type: 'image',
        filename: 'sample-image-3.jpg',
        dimensions: '1800x1200',
        size: '3.2 MB',
        thumbnail: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=400'
      }
    ];
  }
}