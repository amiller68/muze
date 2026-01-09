/**
 * Format milliseconds as MM:SS.cc (minutes:seconds.centiseconds)
 */
export const formatTime = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
};

/**
 * Format milliseconds as M:SS (minutes:seconds)
 */
export const formatTimeShort = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
};
