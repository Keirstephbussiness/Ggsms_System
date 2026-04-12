document.addEventListener('DOMContentLoaded', function () {

    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        height: 'auto',

        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },

        // We'll add holidays dynamically below
        eventSources: [],

        // Click on any date cell → show modal with holidays/events on that day
        dateClick: function (info) {
            const clickedDate = info.date;
            const clickedDateStr = clickedDate.toISOString().split('T')[0]; // YYYY-MM-DD

            // Format for display
            const displayDate = clickedDate.toLocaleDateString('en-PH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Get all events on this day (holidays we added + any future custom events)
            const eventsOnDay = calendar.getEvents().filter(event => {
                const eventStart = event.start.toISOString().split('T')[0];
                // For all-day events, end might be next day → we check start date
                return eventStart === clickedDateStr;
            });

            let content = `<p><strong>Date:</strong> ${displayDate}</p>`;

            if (eventsOnDay.length === 0) {
                content += '<p>No holidays or events on this day.</p>';
            } else {
                content += '<h3>Holidays / Events:</h3><ul>';
                eventsOnDay.forEach(ev => {
                    content += `<li><strong>${ev.title}</strong></li>`;
                });
                content += '</ul>';
            }

            // Update modal
            document.getElementById('eventModalTitle').textContent =
                `Details for ${clickedDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`;
            document.getElementById('eventDetails').innerHTML = content;

            // Show modal
            document.getElementById('eventModalOverlay').style.display = 'flex';
        },

        // Optional: if you later add clickable foreground events
        eventClick: function (info) {
            info.jsEvent.preventDefault();
            // Can expand later if needed
        }
    });

    calendar.render();

    // ───────────────────────────────────────────────
    // Fetch Philippine holidays from Nager.Date API
    // ───────────────────────────────────────────────
    function loadPhilippineHolidays() {
        const currentYear = new Date().getFullYear(); // e.g. 2026
        const apiUrl = `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/PH`;

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch holidays');
                return response.json();
            })
            .then(holidays => {
                const events = holidays.map(holiday => ({
                    title: holiday.name,                // English name
                    start: holiday.date,                // YYYY-MM-DD
                    allDay: true,
                    display: 'background',              // gold background like before
                    color: '#D4AF37',                   // gold
                    classNames: ['ph-holiday-bg'],
                    extendedProps: {
                        localName: holiday.localName,
                        type: holiday.types?.join(', ') || 'Public Holiday'
                    }
                }));

                calendar.addEventSource(events);
            })
            .catch(error => {
                console.error('Error loading Philippine holidays:', error);
                // Optional: show user-friendly message
                // alert('Could not load holidays. Please check your internet connection.');
            });
    }

    // Load holidays when calendar is ready
    loadPhilippineHolidays();

    // ───────────────────────────────────────────────
    // Modal close logic
    // ───────────────────────────────────────────────
    const modalOverlay = document.getElementById('eventModalOverlay');
    const closeBtn = document.getElementById('eventModalCloseBtn');

    function closeModal() {
        modalOverlay.style.display = 'none';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeModal();
    });

    // Today button (your custom one)
    document.getElementById('todayBtn')?.addEventListener('click', () => {
        calendar.today();
    });
});