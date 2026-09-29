"use strict";

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const btnFormSubmit = document.querySelector(".form__btn");
const btnFormCancel = document.querySelector(".form__cancel");

const workoutsHeader = document.querySelector(".workouts__header");
const workoutsCount = document.querySelector(".workouts__count");
const btnDeleteAll = document.querySelector(".workouts__delete-all");
const emptyState = document.querySelector(".empty-state");

const modalDeleteAll = document.querySelector(".modal");
const modalText = document.querySelector(".modal__text");
const btnModalCancel = document.querySelector(".modal__cancel");
const btnModalConfirm = document.querySelector(".modal__confirm");

const mapContainer = document.querySelector("#map");
const mapFallback = document.querySelector(".map-fallback");
const mapFallbackTitle = document.querySelector(".map-fallback__title");
const mapFallbackText = document.querySelector(".map-fallback__text");
const btnRetryLocation = document.querySelector(".map-fallback__retry");
const btnSkipLocation = document.querySelector(".map-fallback__skip");

const DEFAULT_COORDS = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

const FIELD_RULES = {
  distance: { label: "distance", unit: "km", min: 0, max: 1000, allowZero: false },
  duration: { label: "duration", unit: "min", min: 0, max: 1440, allowZero: false },
  cadence: { label: "cadence", unit: "spm", min: 0, max: 300, allowZero: false },
  elevation: { label: "elevation", unit: "m", min: -1000, max: 10000, allowZero: true },
};

const ICONS = {
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>`,
  delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>`,
};

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = "cycling";
  constructor(coords, distance, duration, elevation) {
    super(coords, distance, duration);
    this.elevation = elevation;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  #workouts = [];
  #markers = new Map();
  #fitAllBtn;
  #submitAttempted = false;
  #editingId = null;

  constructor() {
    this._getLocalStorage();

    this._getPosition();

    form.addEventListener("submit", this._submitForm.bind(this));
    btnFormCancel.addEventListener("click", this._hideForm.bind(this));

    inputType.addEventListener("change", this._syncTypeFields.bind(this));

    containerWorkouts.addEventListener("click", this._handleListClick.bind(this));

    [inputDistance, inputDuration, inputCadence, inputElevation].forEach(
      (input) =>
        input.addEventListener("input", () => {
          if (this.#submitAttempted) this._validateField(input);
        })
    );

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || modalDeleteAll.open) return;
      if (containerWorkouts.querySelector(".workout__confirm")) {
        this._closeDeleteConfirm();
        return;
      }
      if (!form.classList.contains("hidden")) this._hideForm();
    });

    btnDeleteAll.addEventListener("click", this._openDeleteAllModal.bind(this));
    btnModalCancel.addEventListener("click", () => modalDeleteAll.close());
    btnModalConfirm.addEventListener("click", () => {
      modalDeleteAll.close();
      this._deleteAllWorkouts();
    });
    modalDeleteAll.addEventListener("click", (e) => {
      if (e.target === modalDeleteAll) modalDeleteAll.close();
    });

    btnRetryLocation.addEventListener("click", this._retryLocation.bind(this));
    btnSkipLocation.addEventListener("click", this._continueWithoutLocation.bind(this));

    this._watchPermission();
    this._updateListUI();
  }

  _getPosition() {
    if (!navigator.geolocation) {
      this._showFallback(
        "unsupported",
        "Location isn't available",
        "Your browser doesn't support location. You can still use the map without it."
      );
      return;
    }

    this._showFallback(
      "loading",
      "Finding your location…",
      "Allow location access when your browser asks, so the map can open where you are."
    );

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this._loadMap([latitude, longitude], this.#mapZoomLevel);
      },
      this._handleLocationError.bind(this),
      { timeout: 15000, maximumAge: 60000 }
    );
  }

  _handleLocationError(error) {
    if (this.#map) return;

    if (error.code === error.PERMISSION_DENIED) {
      this._showFallback(
        "denied",
        "Location access needed",
        "Mapty needs your location to open the map where you are. Tap “Enable location” and choose Allow."
      );
      this._explainIfBlocked();
      return;
    }

    this._showFallback(
      "error",
      "Couldn't get your location",
      error.code === error.TIMEOUT
        ? "Finding your location took too long. Check your connection or GPS and try again."
        : "Your location isn't available right now. Check that location services are on and try again."
    );
  }

  async _explainIfBlocked() {
    const state = await this._getPermissionState();
    if (state === "denied" && !this.#map) {
      mapFallbackText.textContent =
        "Location is blocked for this site. Click the lock icon (or site settings) next to the address bar, set Location to Allow, then tap “Enable location”.";
    }
  }

  async _getPermissionState() {
    try {
      if (!navigator.permissions?.query) return "unknown";
      const status = await navigator.permissions.query({ name: "geolocation" });
      return status.state;
    } catch {
      return "unknown";
    }
  }

  async _watchPermission() {
    try {
      if (!navigator.permissions?.query) return;
      const status = await navigator.permissions.query({ name: "geolocation" });
      status.addEventListener("change", () => {
        if (status.state === "granted" && !this.#map) this._getPosition();
      });
    } catch {}
  }

  _retryLocation() {
    this._getPosition();
  }

  _continueWithoutLocation() {
    if (this.#map) return;
    this._loadMap(DEFAULT_COORDS, DEFAULT_ZOOM);
    if (this.#workouts.length) this._fitAllWorkouts(false);
  }

  _showFallback(state, title, text) {
    mapFallback.dataset.state = state;
    mapFallbackTitle.textContent = title;
    mapFallbackText.textContent = text;
  }

  _hideFallback() {
    mapFallback.dataset.state = "hidden";
  }

  _loadMap(coords, zoom) {
    if (this.#map) return;
    this._hideFallback();

    this.#map = L.map("map").setView(coords, zoom);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this._addFitAllControl();

    this.#map.on("click", this._showForm.bind(this));

    this.#workouts.forEach((workout) => {
      this._renderWorkoutMarker(workout);
    });

    if ("ResizeObserver" in window) {
      new ResizeObserver(() => this.#map.invalidateSize()).observe(mapContainer);
    } else {
      window.addEventListener("resize", () => this.#map.invalidateSize());
    }
  }

  _addFitAllControl() {
    const app = this;
    const FitAllControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar leaflet-control leaflet-control-fitall"
        );
        const btn = L.DomUtil.create("a", "leaflet-control-fitall__btn", container);
        btn.href = "#";
        btn.title = "Show all workouts";
        btn.setAttribute("role", "button");
        btn.setAttribute("aria-label", "Show all workouts");
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>`;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.preventDefault(e);
          app._fitAllWorkouts(true);
        });

        app.#fitAllBtn = btn;
        return container;
      },
    });

    this.#map.addControl(new FitAllControl());
    this._updateFitAllBtn();
  }

  _updateFitAllBtn() {
    if (!this.#fitAllBtn) return;
    const disabled = this.#workouts.length === 0;
    this.#fitAllBtn.classList.toggle("leaflet-disabled", disabled);
    this.#fitAllBtn.setAttribute("aria-disabled", String(disabled));
    this.#fitAllBtn.title = disabled
      ? "Add a workout to use this"
      : "Show all workouts";
  }

  _fitAllWorkouts(animate = true) {
    if (!this.#map || this.#workouts.length === 0) return;

    if (this.#workouts.length === 1) {
      this.#map.setView(this.#workouts[0].coords, this.#mapZoomLevel, { animate });
      return;
    }

    const bounds = L.latLngBounds(this.#workouts.map((w) => w.coords));
    this.#map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: this.#mapZoomLevel,
      animate,
    });
  }

  _showForm(mapE) {
    if (this.#editingId) this._exitEditMode();
    this.#mapEvent = mapE;
    this._openForm();
  }

  _openForm() {
    this._closeDeleteConfirm();
    form.classList.remove("hidden");
    this._updateListUI();
    containerWorkouts.scrollTo({ top: 0, behavior: "smooth" });
    inputDistance.focus({ preventScroll: true });
  }

  _hideForm() {
    this._clearFormInputs();
    this._exitEditMode();
    this.#mapEvent = null;

    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => {
      form.style.display = "grid";
    }, 1000);

    this._updateListUI();
  }

  _clearFormInputs() {
    inputDistance.value =
      inputCadence.value =
      inputElevation.value =
      inputDuration.value =
        "";
    this._clearErrors();
    this.#submitAttempted = false;
  }

  _syncTypeFields() {
    const isRunning = inputType.value === "running";
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden", !isRunning);
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden", isRunning);
    this._setFieldError(isRunning ? inputElevation : inputCadence, "");
  }

  _fieldName(input) {
    return input.id.replace("input-", "");
  }

  _getFieldError(input) {
    const rule = FIELD_RULES[this._fieldName(input)];
    const raw = input.value.trim();

    if (raw === "") return `Enter a ${rule.label}`;
    if (!/^-?\d*\.?\d+$/.test(raw)) return "Enter a valid number";

    const value = Number(raw);
    if (rule.allowZero) {
      if (value < rule.min) return `Must be ${rule.min} ${rule.unit} or more`;
    } else if (value <= rule.min) {
      return `Must be greater than ${rule.min}`;
    }
    if (value > rule.max) return `Max ${rule.max} ${rule.unit}`;

    return "";
  }

  _setFieldError(input, message) {
    const errorEl = input.closest(".form__row").querySelector(".form__error");
    errorEl.textContent = message;
    input.classList.toggle("form__input--invalid", Boolean(message));
    input.setAttribute("aria-invalid", String(Boolean(message)));
  }

  _validateField(input) {
    const message = this._getFieldError(input);
    this._setFieldError(input, message);
    return !message;
  }

  _clearErrors() {
    [inputDistance, inputDuration, inputCadence, inputElevation].forEach((input) =>
      this._setFieldError(input, "")
    );
  }

  _readForm() {
    this.#submitAttempted = true;

    const type = inputType.value;
    const extraInput = type === "running" ? inputCadence : inputElevation;
    const fields = [inputDistance, inputDuration, extraInput];

    const results = fields.map((input) => this._validateField(input));
    if (results.includes(false)) {
      fields[results.indexOf(false)].focus();
      return null;
    }

    return {
      type,
      distance: +inputDistance.value,
      duration: +inputDuration.value,
      extra: +extraInput.value,
    };
  }

  _createWorkout({ type, distance, duration, extra }, coords) {
    return type === "running"
      ? new Running(coords, distance, duration, extra)
      : new Cycling(coords, distance, duration, extra);
  }

  _submitForm(e) {
    e.preventDefault();
    if (this.#editingId) this._saveEditedWorkout();
    else this._newWorkout();
  }

  _newWorkout() {
    if (!this.#mapEvent) return;

    const values = this._readForm();
    if (!values) return;

    const { lat, lng } = this.#mapEvent.latlng;
    const workout = this._createWorkout(values, [lat, lng]);

    this.#workouts.push(workout);

    this._renderWorkout(workout);

    this._renderWorkoutMarker(workout);

    this._hideForm();

    this._setLocalStorage();
  }

  _startEdit(id) {
    const workout = this.#workouts.find((w) => w.id === id);
    if (!workout) return;

    this._clearFormInputs();
    this._exitEditMode();
    this.#editingId = id;
    this.#mapEvent = null;

    inputType.value = workout.type;
    this._syncTypeFields();
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    if (workout.type === "running") inputCadence.value = workout.cadence;
    else inputElevation.value = workout.elevation;

    form.classList.add("form--editing");
    btnFormSubmit.textContent = "Save";
    this._getWorkoutEl(id)?.classList.add("workout--editing");

    this._openForm();
  }

  _exitEditMode() {
    if (this.#editingId) this._getWorkoutEl(this.#editingId)?.classList.remove("workout--editing");
    this.#editingId = null;
    form.classList.remove("form--editing");
    btnFormSubmit.textContent = "OK";
  }

  _saveEditedWorkout() {
    const index = this.#workouts.findIndex((w) => w.id === this.#editingId);
    if (index === -1) return this._hideForm();

    const values = this._readForm();
    if (!values) return;

    const old = this.#workouts[index];
    const updated = this._createWorkout(values, old.coords);
    updated.id = old.id;
    updated.date = old.date;
    updated._setDescription();

    this.#workouts[index] = updated;

    const oldEl = this._getWorkoutEl(old.id);
    if (oldEl) this._renderWorkout(updated, oldEl);
    this._removeWorkoutMarker(old.id);
    this._renderWorkoutMarker(updated);

    this._hideForm();
    this._setLocalStorage();
  }

  _openDeleteConfirm(workoutEl) {
    this._closeDeleteConfirm();
    workoutEl.insertAdjacentHTML(
      "beforeend",
      `<div class="workout__confirm" role="alertdialog" aria-label="Delete this workout?">
        <span class="workout__confirm-text">Delete this workout?</span>
        <div class="workout__confirm-actions">
          <button class="btn btn--ghost workout__confirm-no" type="button">Cancel</button>
          <button class="btn btn--danger workout__confirm-yes" type="button">Delete</button>
        </div>
      </div>`
    );
    workoutEl.querySelector(".workout__confirm-no").focus();
  }

  _closeDeleteConfirm() {
    containerWorkouts.querySelectorAll(".workout__confirm").forEach((el) => el.remove());
  }

  _deleteWorkout(id) {
    if (this.#editingId === id) this._hideForm();

    this.#workouts = this.#workouts.filter((w) => w.id !== id);
    this._getWorkoutEl(id)?.remove();
    this._removeWorkoutMarker(id);

    this._setLocalStorage();
    this._updateListUI();
  }

  _openDeleteAllModal() {
    const n = this.#workouts.length;
    modalText.textContent = `This will permanently remove ${
      n === 1 ? "your 1 workout" : `all ${n} workouts`
    }. This can't be undone.`;
    modalDeleteAll.showModal();
    btnModalCancel.focus();
  }

  _deleteAllWorkouts() {
    if (!form.classList.contains("hidden")) this._hideForm();

    this.#workouts.forEach((w) => this._removeWorkoutMarker(w.id));
    this.#workouts = [];
    containerWorkouts.querySelectorAll(".workout").forEach((el) => el.remove());

    localStorage.removeItem("workouts");
    this._updateListUI();
  }

  _updateListUI() {
    const count = this.#workouts.length;
    const formOpen = !form.classList.contains("hidden");

    workoutsHeader.classList.toggle("hidden", count === 0);
    workoutsCount.textContent = `${count} workout${count === 1 ? "" : "s"}`;
    emptyState.classList.toggle("hidden", count > 0 || formOpen);

    this._updateFitAllBtn();
  }

  _getWorkoutEl(id) {
    return containerWorkouts.querySelector(`.workout[data-id="${id}"]`);
  }

  _formatTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  _getTitle(workout) {
    return `${workout.description} <span class="workout__time">· ${this._formatTime(workout.date)}</span>`;
  }

  _renderWorkoutMarker(workout) {
    if (!this.#map) return;
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${this._getTitle(workout)}`
      )
      .openPopup();
    this.#markers.set(workout.id, marker);
  }

  _removeWorkoutMarker(id) {
    this.#markers.get(id)?.remove();
    this.#markers.delete(id);
  }

  _renderWorkout(workout, replaceEl = null) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${this._getTitle(workout)}</h2>
          <div class="workout__actions">
            <button class="workout__btn workout__btn--edit" type="button" title="Edit workout" aria-label="Edit workout">${ICONS.edit}</button>
            <button class="workout__btn workout__btn--delete" type="button" title="Delete workout" aria-label="Delete workout">${ICONS.delete}</button>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          `;

    if (workout.type === "running") {
      html += `
       <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(2)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;
    }
    if (workout.type === "cycling") {
      html += `
         <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(2)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevation}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;
    }

    if (replaceEl) replaceEl.outerHTML = html;
    else form.insertAdjacentHTML("afterend", html);

    this._updateListUI();
  }

  _handleListClick(e) {
    const workoutEl = e.target.closest(".workout");
    if (!workoutEl) return;
    const id = workoutEl.dataset.id;

    if (e.target.closest(".workout__confirm-yes")) return this._deleteWorkout(id);
    if (e.target.closest(".workout__confirm-no")) return this._closeDeleteConfirm();
    if (e.target.closest(".workout__confirm")) return;
    if (e.target.closest(".workout__btn--delete")) return this._openDeleteConfirm(workoutEl);
    if (e.target.closest(".workout__btn--edit")) return this._startEdit(id);

    this._moveToPopup(id);
  }

  _moveToPopup(id) {
    if (!this.#map) return;

    const workout = this.#workouts.find((w) => w.id === id);
    if (!workout) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });

    this.#markers.get(id)?.openPopup();
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    let data;
    try {
      data = JSON.parse(localStorage.getItem("workouts"));
    } catch {
      data = null;
    }
    if (!Array.isArray(data)) return;

    this.#workouts = data
      .map((obj) => {
        let workout;
        if (obj.type === "running")
          workout = new Running(obj.coords, obj.distance, obj.duration, obj.cadence);
        else if (obj.type === "cycling")
          workout = new Cycling(obj.coords, obj.distance, obj.duration, obj.elevation);
        else return null;

        workout.id = obj.id;
        workout.date = new Date(obj.date);
        workout.description = obj.description;
        return workout;
      })
      .filter(Boolean);

    this.#workouts.forEach((workout) => {
      this._renderWorkout(workout);
    });
  }
}
const app = new App();
