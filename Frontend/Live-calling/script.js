function updateDateTime() {
  const now = new Date();

  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  };

  const date = now.toLocaleDateString('en-US', options);

  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  document.getElementById("datetime").textContent = `${time} • ${date}`;
}

updateDateTime();

setInterval(updateDateTime, 1000);