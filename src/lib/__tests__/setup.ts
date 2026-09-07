// Run the whole suite in a half-hour-offset timezone west of UTC. Any date
// helper that leaks a local getter (getDate, setHours, toLocaleDateString…)
// onto a UTC-midnight date will be off by one day here and fail loudly.
process.env.TZ = "America/St_Johns"
