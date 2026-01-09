import { describe, expect, it } from "vitest";
import { formatTime, formatTimeShort } from "./time";

describe("formatTime", () => {
  it("formats zero milliseconds", () => {
    expect(formatTime(0)).toBe("00:00.00");
  });

  it("formats milliseconds with centiseconds", () => {
    expect(formatTime(1234)).toBe("00:01.23");
  });

  it("formats seconds correctly", () => {
    expect(formatTime(5000)).toBe("00:05.00");
    expect(formatTime(59000)).toBe("00:59.00");
  });

  it("formats minutes correctly", () => {
    expect(formatTime(60000)).toBe("01:00.00");
    expect(formatTime(90000)).toBe("01:30.00");
  });

  it("formats multi-minute durations", () => {
    expect(formatTime(125340)).toBe("02:05.34");
    expect(formatTime(600000)).toBe("10:00.00");
  });

  it("handles edge cases", () => {
    expect(formatTime(999)).toBe("00:00.99");
    expect(formatTime(1000)).toBe("00:01.00");
  });
});

describe("formatTimeShort", () => {
  it("formats zero milliseconds", () => {
    expect(formatTimeShort(0)).toBe("0:00");
  });

  it("formats seconds correctly", () => {
    expect(formatTimeShort(5000)).toBe("0:05");
    expect(formatTimeShort(59000)).toBe("0:59");
  });

  it("formats minutes correctly", () => {
    expect(formatTimeShort(60000)).toBe("1:00");
    expect(formatTimeShort(90000)).toBe("1:30");
  });

  it("formats multi-minute durations", () => {
    expect(formatTimeShort(125000)).toBe("2:05");
    expect(formatTimeShort(600000)).toBe("10:00");
  });

  it("truncates milliseconds", () => {
    expect(formatTimeShort(1999)).toBe("0:01");
    expect(formatTimeShort(61500)).toBe("1:01");
  });
});
