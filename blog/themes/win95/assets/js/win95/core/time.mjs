export const newZealandTimeZone = "Pacific/Auckland";

const zonedPartsFormatter = new Intl.DateTimeFormat("en-NZ", {
  timeZone: newZealandTimeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const taskbarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: newZealandTimeZone,
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long"
});

const readNumericParts = (date) => Object.fromEntries(zonedPartsFormatter
  .formatToParts(date)
  .filter((part) => part.type !== "literal")
  .map((part) => [part.type, Number(part.value)]));

export const getNewZealandDateTime = (date = new Date()) => {
  const parts = readNumericParts(date);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
};

export const formatNewZealandTaskbarTime = (date = new Date()) => taskbarFormatter
  .format(date)
  .toUpperCase();

export const formatDialogTime = (parts) => [parts.hour, parts.minute, parts.second]
  .map((value) => String(value).padStart(2, "0"))
  .join(":");

export const getMonthName = (month) => monthFormatter.format(new Date(Date.UTC(2000, month - 1, 1)));

export const buildMonthCalendar = (year, month) => {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
};

export const getClockHandAngles = ({ hour, minute, second }) => ({
  hour: ((hour % 12) * 30) + (minute * 0.5) + (second / 120),
  minute: (minute * 6) + (second * 0.1),
  second: second * 6
});
