import { createElement, type CSSProperties } from 'react';

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
  const style: CSSProperties = {
    display: 'block',
    width,
    height,
    border: 0,
  };

  return createElement('iframe', {
    src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?controls=1&rel=0`,
    title: 'Video hướng dẫn bài tập',
    width,
    height,
    style,
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
}
