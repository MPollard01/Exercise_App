'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const sidebar = document.querySelector('.sidebar');
const deleteEl = document.querySelector('.delete-all');
const sortMenu = document.getElementById('sort-menu');
const sort = document.querySelector('.sort');
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
}

class Cycling extends Workout {
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
    form.addEventListener('submit', this._submitEdit.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    sidebar.addEventListener('click', this._hideOnClick);
    deleteEl.addEventListener('click', this._deleteAll.bind(this));
    sortMenu.addEventListener('change', this._sortBy.bind(this));
    sort.addEventListener('click', this._order.bind(this));
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
    containerWorkouts.insertBefore(form, containerWorkouts.firstChild);

    form.classList.remove('form__edit');
    if (form.classList.contains('hidden')) {
      window.getComputedStyle(form).display;
      form.classList.remove('hidden');
    } else {
      form.classList.add('hidden');
      setTimeout(() => form.classList.remove('hidden'), 10);
    }

    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    inputDistance.focus();

    containerWorkouts.scrollTo({ behavior: 'smooth', top: 0 });
  }

  _hideOnClick(e) {
    if (!e.target.isEqualNode(sidebar)) return;

    form.classList.add('hidden');
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
    form.classList.remove('form__edit');
    containerWorkouts.insertBefore(form, containerWorkouts.firstChild);
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _workoutObj(lat, lng) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    return workout;
  }

  _newWorkout(e) {
    e.preventDefault();

    if (form.classList.contains('form__edit')) return;

    const { lat, lng } = this.#mapEvent.latlng;
    const workout = this._workoutObj(lat, lng);

    this._renderAndSave(workout);
  }

  _submitEdit(e) {
    e.preventDefault();

    const workoutElement = e.target.closest('.workout');

    if (!workoutElement) return;

    const workoutIndex = this.#workouts.findIndex(
      wo => wo.id === workoutElement.dataset.id
    );

    const [lat, lng] = this.#workouts[workoutIndex].coords;

    const workout = this._workoutObj(lat, lng);
    workout.id = this.#workouts[workoutIndex].id;
    this.#workouts.splice(workoutIndex, 1);

    this._renderAndSave(workout, e);
  }

  _renderAndSave(workout, e) {
    // add new object to workout array
    this.#workouts.push(workout);

    // render wourkout on map as marker
    this._renderWorkoutMarker(workout);

    // render workout on list
    this._renderWorkout(workout, e);

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

  _renderWorkout(workout, e) {
    const html = this._getWorkoutHTML(workout);

    if (!form.classList.contains('form__edit'))
      form.insertAdjacentHTML('afterend', html);
    else {
      const workoutElement = e.target.closest('.workout');
      workoutElement.outerHTML = html;
    }
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

  _editWorkout(e) {
    const workoutEditEl = e.target.closest('.workout__edit');

    if (!workoutEditEl) return;

    const workoutElement = e.target.closest('.workout');

    // smooth transitions
    if (containerWorkouts.firstChild.isEqualNode(form)) {
      form.classList.add('hidden');
      setTimeout(() => {
        workoutElement.appendChild(form);
        window.getComputedStyle(form).display;
        form.classList.add('form__edit');
        form.classList.remove('hidden');
      }, 700);
    } else {
      workoutElement.appendChild(form);
      form.classList.add('form__edit');

      if (form.classList.contains('hidden')) {
        window.getComputedStyle(form).display;
        form.classList.remove('hidden');
      } else {
        form.classList.add('hidden');
        setTimeout(() => form.classList.remove('hidden'), 10);
      }
    }

    const workout = this.#workouts.find(
      wo => wo.id === workoutElement.dataset.id
    );

    if (workout.type === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
    } else {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    }

    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    inputType.value === 'running'
      ? (inputCadence.value = workout.cadence)
      : (inputElevation.value = workout.elevation);
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

  _deleteAll() {
    const workoutEls = document.querySelectorAll('.workout');

    if (!workoutEls) return;

    this.#map.eachLayer(layer => this.#map.removeLayer(layer));
    this.#mapLayers = this.#workouts = [];
    workoutEls.forEach(el => el.remove());
    localStorage.removeItem('workouts');
    location.reload();
  }

  _sortBy() {
    const workoutEls = document.querySelectorAll('.workout');

    if (!workoutEls) return;

    const sorted = this.#workouts.slice().sort(this._orderBy.call(this));

    workoutEls.forEach(
      (el, i) => (el.outerHTML = this._getWorkoutHTML(sorted[i]))
    );
  }

  _order() {
    if (sort.textContent === 'sort by ↾') sort.textContent = 'sort by ⇂';
    else sort.textContent = 'sort by ↾';

    this._sortBy();
  }

  _orderBy() {
    const desc = function (a, b) {
      if (a[sortMenu.value] > b[sortMenu.value]) {
        return -1;
      }
      if (a[sortMenu.value] < b[sortMenu.value]) {
        return 1;
      }
      return 0;
    };

    const asc = function (a, b) {
      if (a[sortMenu.value] < b[sortMenu.value]) {
        return -1;
      }
      if (a[sortMenu.value] > b[sortMenu.value]) {
        return 1;
      }
      return 0;
    };

    if (sort.textContent === 'sort by ↾') return asc;
    if (sort.textContent === 'sort by ⇂') return desc;
  }
}

const app = new App();

/*
  Additional features
  - Ability to edit a workout *
  - Ability to delete a workout *
  - Ability to delete all workouts *
  - Ability to sort workouts by a certain field (eg. distance) *
  - Re-build Running and Cycling objects coming from Local Storage
  - More realistic error and confirmation errors
  - Abalitity to position the map to show all workouts
  - Ability to draw lines and shapes instead of just points
  - Geocode location from coordinates ("Run in Faro, Portugal")
  - Display weather data for workout time and place
*/
