const CACHE_NAME = 'school-planner-v1';
const STATIC_ASSETS = [
  '/School_Planner_V1/app.html',
  '/School_Planner_V1/manifest.json',
  '/School_Planner_V1/css/variables.css',
  '/School_Planner_V1/css/base.css',
  '/School_Planner_V1/css/components.css',
  '/School_Planner_V1/css/sidebar.css',
  '/School_Planner_V1/css/dashboard.css',
  '/School_Planner_V1/css/timetable.css',
  '/School_Planner_V1/css/homework.css',
  '/School_Planner_V1/css/grades.css',
  '/School_Planner_V1/css/calendar.css',
  '/School_Planner_V1/css/exams.css',
  '/School_Planner_V1/css/messages.css',
  '/School_Planner_V1/css/substitution.css',
  '/School_Planner_V1/css/settings.css',
  '/School_Planner_V1/js/supabase.min.js',
  '/School_Planner_V1/js/chart.min.js',
  '/School_Planner_V1/js/theme.js',
  '/School_Planner_V1/js/supabase-client.js',
  '/School_Planner_V1/js/utils.js',
  '/School_Planner_V1/js/app.js',
  '/School_Planner_V1/js/admin.js',
  '/School_Planner_V1/js/school-admin.js',
  '/School_Planner_V1/js/dashboard.js',
  '/School_Planner_V1/js/timetable.js',
  '/School_Planner_V1/js/homework.js',
  '/School_Planner_V1/js/grades.js',
  '/School_Planner_V1/js/exams.js',
  '/School_Planner_V1/js/calendar.js',
  '/School_Planner_V1/js/substitution.js',
  '/School_Planner_V1/js/messages.js',
  '/School_Planner_V1/js/tests.js',
  '/School_Planner_V1/js/subjects.js',
  '/School_Planner_V1/js/notifications.js',
  '/School_Planner_V1/js/pwa.js',
  '/School_Planner_V1/icons/icon-192.svg',
  '/School_Planner_V1/icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }))
    );
  }
});
