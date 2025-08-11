import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Download, Globe, Image, Video, Music, FileImage, Loader2, AlertCircle } from 'lucide-react';
import { MediaDetectionService, MediaItem } from '@/services/MediaDetectionService';
import { MediaGrid } from '@/components/MediaGrid';

export const MediaDownloader = () => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setMediaItems([]);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const items = await MediaDetectionService.detectMedia(url);
      
      clearInterval(progressInterval);
      setProgress(100);
      setMediaItems(items);

      toast({
        title: "Analysis Complete",
        description: `Found ${items.length} media items`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the webpage. Please check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      default: return <FileImage className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl gradient-primary shadow-glow">
              <Download className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MediaHarvest
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Extract and download all media content from any webpage, including images, videos, and audio files
          </p>
        </div>

        {/* URL Input */}
        <Card className="p-8 mb-8 shadow-card">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://example.com/page-with-media"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-12 h-14 text-lg bg-input/50 backdrop-blur-sm border-border/50 focus:border-primary transition-smooth"
                  disabled={isAnalyzing}
                />
              </div>
              <Button 
                onClick={handleAnalyze} 
                className="h-14 px-8 text-lg"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : 'Analyze'}
              </Button>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !url}
              variant="hero"
              size="lg"
              className="h-14 px-8"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Analyze Page
                </>
              )}
            </Button>
          </div>

          {isAnalyzing && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Scanning webpage for media content...
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </Card>

        {/* Results */}
        {mediaItems.length > 0 && (
          <div className="space-y-6">
            {/* Stats */}
            <Card className="p-6 shadow-card">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Items', value: mediaItems.length, icon: <FileImage /> },
                  { label: 'Images', value: mediaItems.filter(item => item.type === 'image').length, icon: <Image /> },
                  { label: 'Videos', value: mediaItems.filter(item => item.type === 'video').length, icon: <Video /> },
                  { label: 'Audio', value: mediaItems.filter(item => item.type === 'audio').length, icon: <Music /> },
                ].map((stat, index) => (
                  <div key={index} className="text-center p-4 rounded-xl gradient-secondary">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary mb-3">
                      {React.cloneElement(stat.icon, { className: "w-6 h-6 text-primary-foreground" })}
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Media Grid */}
            <MediaGrid items={mediaItems} />
          </div>
        )}

        {/* Empty State */}
        {!isAnalyzing && mediaItems.length === 0 && url && (
          <Card className="p-12 text-center shadow-card">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Media Found</h3>
            <p className="text-muted-foreground">
              Try a different URL or check if the page contains downloadable media content.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};