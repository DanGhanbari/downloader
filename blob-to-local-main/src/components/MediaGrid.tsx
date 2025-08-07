import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Download, ExternalLink, Image, Video, Music, FileImage, Check, Loader2 } from 'lucide-react';
import { MediaItem } from '@/services/MediaDetectionService';
import { DownloadService } from '@/services/DownloadService';

interface MediaGridProps {
  items: MediaItem[];
}

export const MediaGrid = ({ items }: MediaGridProps) => {
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set());
  const [downloadedItems, setDownloadedItems] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      default: return <FileImage className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'video': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'audio': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleDownload = async (item: MediaItem) => {
    const itemId = item.url;
    
    if (downloadingItems.has(itemId) || downloadedItems.has(itemId)) {
      return;
    }

    setDownloadingItems(prev => new Set(prev).add(itemId));
    setDownloadProgress(prev => ({ ...prev, [itemId]: 0 }));

    try {
      // Simulate download progress
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => ({
          ...prev,
          [itemId]: Math.min((prev[itemId] || 0) + 10, 90)
        }));
      }, 100);

      await DownloadService.downloadMedia(item);
      
      clearInterval(progressInterval);
      setDownloadProgress(prev => ({ ...prev, [itemId]: 100 }));
      
      setTimeout(() => {
        setDownloadingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
        setDownloadedItems(prev => new Set(prev).add(itemId));
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[itemId];
          return newProgress;
        });
      }, 500);

      toast({
        title: "Download Complete",
        description: `${item.filename} has been downloaded successfully`,
      });
    } catch (error) {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[itemId];
        return newProgress;
      });

      toast({
        title: "Download Failed",
        description: `Could not download ${item.filename}`,
        variant: "destructive",
      });
    }
  };

  const handleDownloadAll = async () => {
    const nonDownloadedItems = items.filter(item => 
      !downloadingItems.has(item.url) && !downloadedItems.has(item.url)
    );

    if (nonDownloadedItems.length === 0) {
      toast({
        title: "Nothing to Download",
        description: "All items have already been downloaded",
      });
      return;
    }

    toast({
      title: "Bulk Download Started",
      description: `Downloading ${nonDownloadedItems.length} items...`,
    });

    // Download items one by one to avoid overwhelming the browser
    for (const item of nonDownloadedItems) {
      await handleDownload(item);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  return (
    <div className="space-y-6">
      {/* Download All Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Media Content</h2>
        <Button
          onClick={handleDownloadAll}
          variant="hero"
          className="shadow-glow"
          disabled={items.length === 0}
        >
          <Download className="w-5 h-5" />
          Download All ({items.length})
        </Button>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item, index) => {
          const isDownloading = downloadingItems.has(item.url);
          const isDownloaded = downloadedItems.has(item.url);
          const progress = downloadProgress[item.url] || 0;

          return (
            <Card key={index} className="overflow-hidden shadow-card hover:shadow-glow transition-smooth group">
              {/* Media Preview */}
              <div className="aspect-video bg-muted/30 relative overflow-hidden">
                {item.type === 'image' && item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center gradient-secondary">
                    {getIcon(item.type)}
                  </div>
                )}
                
                {/* Type Badge */}
                <Badge className={`absolute top-3 left-3 ${getTypeColor(item.type)} border`}>
                  {getIcon(item.type)}
                  {item.type}
                </Badge>

                {/* Size Badge */}
                {item.size && (
                  <Badge variant="secondary" className="absolute top-3 right-3 bg-black/50 text-white border-0">
                    {item.size}
                  </Badge>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground truncate" title={item.filename}>
                    {item.filename}
                  </h3>
                  {item.dimensions && (
                    <p className="text-sm text-muted-foreground">
                      {item.dimensions}
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                {isDownloading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Downloading...</span>
                      <span className="text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading || isDownloaded}
                    variant={isDownloaded ? "secondary" : "default"}
                    size="sm"
                    className="flex-1 transition-smooth"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Downloading
                      </>
                    ) : isDownloaded ? (
                      <>
                        <Check className="w-4 h-4" />
                        Downloaded
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => window.open(item.url, '_blank')}
                    variant="outline"
                    size="sm"
                    className="transition-smooth"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};