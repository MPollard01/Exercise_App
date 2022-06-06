'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

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
  #name;
  type = 'running';

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

  get name() {
    return this.#name;
  }

  set name(val) {
    this.#name = val;
  }
}

class Cycling extends Workout {
  #name;
  type = 'cycling';

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

  get name() {
    return this.#name;
  }

  set name(val) {
    this.#name = val;
  }
}

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #mapLayers = [];

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    // containerWorkouts.addEventListener('click', this._toggleMenu);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    //containerWorkouts.addEventListener('mouseleave', this._closeForm);
    // document.addEventListener('click', this._hideMenu);
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('could not find your location');
        }
      );
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(wo => {
      this._renderWorkoutMarker(wo);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // clear input
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _formIsValid(type, distance, duration, cadence, elevation) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const isPositive = (...inputs) => inputs.every(inp => inp > 0);

    if (type === 'running') {
      if (
        !validInputs(distance, duration, cadence) ||
        !isPositive(distance, duration, cadence)
      ) {
        alert('Inputs have to be positive integers');
        return false;
      }
    }

    if (type === 'cycling') {
      if (
        !validInputs(distance, duration, elevation) ||
        !isPositive(duration, distance)
      ) {
        alert('Inputs have to be positive integers');
        return false;
      }
    }

    return true;
  }

  _newWorkout(e) {
    e.preventDefault();

    // get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    const cadence = +inputCadence.value;
    const elevation = +inputElevation.value;
    let workout;

    // check if data is valid
    if (!this._formIsValid(type, distance, duration, cadence, elevation))
      return;

    if (type === 'running') {
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workout array
    this.#workouts.push(workout);

    // render wourkout on map as marker
    this._renderWorkoutMarker(workout);

    // render workout on list
    this._renderWorkout(workout);

    // hide form + clear input
    this._hideForm();

    // set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords);

    marker
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
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#map.addLayer(marker);
    this.#mapLayers.push(marker);
  }

  _getWorkoutHTML(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <form class="form form__edit hidden">
    <div class="form__row">
      <label class="form__label">Type</label>
      <select class="form__input form__input--type">
        <option value="running">Running</option>
        <option value="cycling">Cycling</option>
      </select>
    </div>
    <div class="form__row">
      <label class="form__label">Distance</label>
      <input class="form__input form__input--distance" placeholder="km" />
    </div>
    <div class="form__row">
      <label class="form__label">Duration</label>
      <input
        class="form__input form__input--duration"
        placeholder="min"
      />
    </div>
    <div class="form__row">
      <label class="form__label">Cadence</label>
      <input
        class="form__input form__input--cadence"
        placeholder="step/min"
      />
    </div>
    <div class="form__row form__row--hidden">
      <label class="form__label">Elev Gain</label>
      <input
        class="form__input form__input--elevation"
        placeholder="meters"
      />
    </div>
    <button class="form__btn">OK</button>
  </form>
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__buttons">
        <button class="workout__btn workout__edit"><svg>
        <use xlink:href="icons.svg#icon-edit"></use>
        </svg></button>
        <button class="workout__btn workout__delete"><svg>
        <use xlink:href="icons.svg#icon-delete"></use>
        </svg></button>
      </div>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>`;

    if (workout.type === 'running')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;

    if (workout.type === 'cycling')
      html += `
      <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevation}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;

    return html;
  }

  _renderWorkout(workout) {
    const html = this._getWorkoutHTML(workout);

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutElement = e.target.closest('.workout');

    if (!workoutElement) return;

    const workout = this.#workouts.find(
      wo => wo.id === workoutElement.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(wo => {
      this._renderWorkout(wo);
    });
  }

  _toggleMenu(e) {
    const workoutMenuEl = e.target.closest('.workout__menu');

    if (!workoutMenuEl) return;

    const container = workoutMenuEl.nextElementSibling;
    const hiddenMenu = document.querySelectorAll('.workout__menu--container');

    hiddenMenu.forEach(m => {
      if (m !== container) m.classList.add('workout-hidden');
    });

    if (container.classList.contains('workout-hidden'))
      container.classList.remove('workout-hidden');
    else container.classList.add('workout-hidden');

    e.stopImmediatePropagation();
  }

  _hideMenu() {
    const hiddenMenu = document.querySelectorAll('.workout__menu--container');
    if (hiddenMenu) {
      hiddenMenu.forEach(m => m.classList.add('workout-hidden'));
    }
  }

  _editWorkout(e) {
    const workoutEditEl = e.target.closest('.workout__edit');

    if (!workoutEditEl) return;

    const workoutElement = e.target.closest('.workout');

    if (!workoutElement) return;

    const editForm = workoutElement.querySelector('.form__edit');
    const type = editForm.querySelector('.form__input--type');
    const distance = editForm.querySelector('.form__input--distance');
    const duration = editForm.querySelector('.form__input--duration');
    const cadence = editForm.querySelector('.form__input--cadence');
    const elevation = editForm.querySelector('.form__input--elevation');

    const workout = this.#workouts.find(
      wo => wo.id === workoutElement.dataset.id
    );

    // show form + add previous values
    editForm.classList.remove('hidden');
    editForm.onchange = function () {
      elevation.closest('.form__row').classList.toggle('form__row--hidden');
      cadence.closest('.form__row').classList.toggle('form__row--hidden');
    };

    if (workout.type === 'cycling') {
      elevation.closest('.form__row').classList.remove('form__row--hidden');
      cadence.closest('.form__row').classList.add('form__row--hidden');
    }

    workoutElement.onmouseleave = function () {
      editForm.classList.add('hidden');
    };

    type.value = workout.type;
    distance.value = workout.distance;
    duration.value = workout.duration;
    type.value === 'running'
      ? (cadence.value = workout.cadence)
      : (elevation.value = workout.elevation);

    editForm.addEventListener(
      'submit',
      event => {
        event.preventDefault();

        if (
          !this._formIsValid(
            type.value,
            +distance.value,
            +duration.value,
            +cadence.value,
            +elevation.value
          )
        )
          return;

        workout.type = type.value;
        workout.distance = +distance.value;
        workout.duration = +duration.value;

        if (type === 'running') {
          workout.cadence = +cadence.value;
        }

        if (type === 'cycling') {
          workout.elevation = +elevation.value;
        }

        workoutElement.outerHTML = this._getWorkoutHTML(workout);

        this._setLocalStorage();
      },
      { once: true }
    );
  }

  _deleteWorkout(e) {
    const workoutDel = e.target.closest('.workout__delete');

    if (!workoutDel) return;

    const workoutElement = e.target.closest('.workout');
    const id = this.#workouts.findIndex(
      wo => wo.id === workoutElement.dataset.id
    );

    this.#map.removeLayer(this.#mapLayers[id]);
    this.#workouts.splice(id, 1);
    this.#mapLayers.splice(id, 1);
    workoutElement.remove();
    this._setLocalStorage();
  }

  _closeForm(e) {
    const allWorkouts = document.querySelectorAll('.form__edit');
    console.log(e.target.querySelector('.form__edit'));
    allWorkouts.forEach(el => el.classList.add('hidden'));
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

/*
  Additional features
  - Ability to edit a workout
  - Ability to delete a workout
  - Ability to delete all workouts
  - Ability to sort workouts by a certain field (eg. distance)
  - Re-build Running and Cycling objects coming from Local Storage
  - More realistic error and confirmation errors
  - Abalitity to position the map to show all workouts
  - Ability to draw lines and shapes instead of just points
  - Geocode location from coordinates ("Run in Faro, Portugal")
  - Display weather data for workout time and place
*/
