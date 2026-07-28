/**
 * Legacy watch deep-link → vertical home loop.
 * Keeps old /my-vibez/watch/:videoId bookmarks working.
 */
import { Navigate, useParams } from "react-router-dom";

export function VideoPlayer() {
  const { videoId } = useParams();
  const target = videoId
    ? `/my-vibez?v=${encodeURIComponent(videoId)}`
    : "/my-vibez";
  return <Navigate to={target} replace />;
}

export default VideoPlayer;
