# 🗺️ Mapty — Map Your Workouts

A responsive workout-tracking web app that lets you log your running and cycling sessions directly on an interactive map. Click anywhere on the map, enter your workout details, and Mapty pins it to the exact spot, calculates your pace or speed, and saves everything in your browser.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)

**🔗 Live demo:** [prasad-k-s.github.io/Mapty](https://prasad-k-s.github.io/Mapty/)

---

## ✨ Features

### 📍 Map & location
- Opens the map at your **current location** using the Geolocation API
- **Location fallback screen** when access is blocked, with a one-click retry and step-by-step help to unblock it
- **Continue without location** — the app stays fully usable, opening around your saved workouts
- Map loads automatically as soon as location permission is granted — no refresh needed
- **"Show all workouts" button** zooms the map to fit every pin

### 🏃 Workouts
- Log **running** (distance, duration, cadence) and **cycling** (distance, duration, elevation gain) workouts
- Automatically calculates **pace** (min/km) for running and **speed** (km/h) for cycling
- Each workout shows the **date and time** it was logged
- Click a workout in the list to fly to its pin on the map

### ✏️ Manage your data
- **Edit** any workout — change values or even switch between running and cycling
- **Delete** a single workout with an inline confirmation
- **Delete all** workouts with a confirmation dialog
- Friendly **empty state** when there are no workouts yet
- All data is **persisted in localStorage**, so workouts survive page reloads

### ✅ Form validation
- Inline, per-field error messages (no `alert()` popups)
- Sensible rules and limits (e.g. distance > 0 and ≤ 1000 km, elevation can be negative)
- Errors update live as you correct them
- Keyboard friendly — `Enter` to submit, `Esc` to close

### 📱 Fully responsive
- **Desktop:** sidebar + map side by side
- **Tablet:** compact sidebar
- **Mobile:** map on top, scrollable workout list below
- **Landscape phones:** side-by-side layout that fits short screens
- Uses **container queries** so cards and the form adapt to the space they actually have
- Touch-friendly buttons, numeric keypads on inputs, and `dvh` units to handle mobile browser bars

---

## 🛠️ Tech Stack

| Technology | Purpose |
| --- | --- |
| **HTML5** | Structure and semantic markup |
| **CSS3** | Flexbox, Grid, container queries, media queries, custom properties |
| **JavaScript (ES2022)** | Classes, private fields, async/await, event delegation |
| **[Leaflet.js](https://leafletjs.com/)** | Interactive map rendering |
| **OpenStreetMap** | Map tiles |
| **Geolocation & Permissions APIs** | User location and permission state |
| **localStorage** | Client-side data persistence |

---

## 🧱 Architecture

The app is built with **Object-Oriented Programming**:

```
Workout            → base class (id, date, coords, distance, duration)
 ├── Running       → adds cadence, calculates pace
 └── Cycling       → adds elevation gain, calculates speed

App                → controls the map, form, list, and storage
```

Key techniques used:
- **Private class fields** (`#map`, `#workouts`) to encapsulate app state
- **Event delegation** — a single listener handles clicks on all workout cards
- **Rehydrating objects** from localStorage back into real `Running` / `Cycling` instances
- **ResizeObserver** to keep the map rendering correctly when the layout changes
- Native **`<dialog>`** element for the delete-all confirmation

---

## 🚀 Getting Started

### Prerequisites
A modern web browser. No build tools or dependencies to install.

### Run locally

```bash
git clone https://github.com/prasad-k-s/Mapty.git
cd Mapty
```

Then open `index.html` with a local server, for example the **Live Server** extension in VS Code.

> **Note:** Browsers only allow geolocation on secure origins (`https://` or `localhost`). If you open the file directly and location doesn't work, use a local server — or click **Continue without location**.

---

## 📂 Project Structure

```
Mapty/
├── index.html    # Markup
├── style.css     # Styles and responsive layout
├── script.js     # App logic (classes, map, form, storage)
├── logo.png
└── icon.png
```

---

## 🔮 Future Improvements

- Sort and filter workouts by type, distance, or date
- Draw routes and shapes instead of single points
- Show weather for each workout location and time
- Show a summary of total distance and time
- Sync workouts to a backend so they're available across devices

---

## 🙏 Credits

The base project comes from [Jonas Schmedtmann's](https://twitter.com/jonasschmedtman) *The Complete JavaScript Course*.

On top of the course version I added a fully responsive layout, inline form validation, a location-permission fallback with "continue without location", a "show all workouts" map control, editing, single and bulk deletion, an empty state, workout times, and several bug fixes.
