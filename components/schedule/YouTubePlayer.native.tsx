import YoutubePlayer from 'react-native-youtube-iframe';

type YouTubePlayerProps = {
  videoId: string;
  width: number;
  height: number;
};

export default function YouTubePlayer({
  videoId,
  width,
  height,
}: YouTubePlayerProps) {
  return (
    <YoutubePlayer
      videoId={videoId}
      width={width}
      height={height}
      initialPlayerParams={{
        controls: true,
        rel: false,
        preventFullScreen: false,
      }}
      webViewProps={{ allowsFullscreenVideo: true }}
    />
  );
}
