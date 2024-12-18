import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

function getDistance(point1: NormalizedLandmark, point2: NormalizedLandmark): number {
  return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2)
}

export { getDistance }
