import Maps from '/maps.js';

// Загрузка данных через await

async function getDataAsync(url) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    });

    // При сетевой ошибке (мы оффлайн) из `fetch` вылетит эксцепшн.
    // Тут мы даём ему просто вылететь из функции дальше наверх.
    // Если же его нужно обработать, придётся обернуть в `try` и сам `fetch`:
    //
    // try {
    //     response = await fetch(url, {...});
    // } catch (error) {
    //     // Что-то делаем
    //     throw error;
    // }

    // Если мы тут, значит, запрос выполнился.
    // Но там может быть 404, 500, и т.д., поэтому проверяем ответ.
    if (response.ok) {
        return response.json();
    }

    // Пример кастомной ошибки (если нужно проставить какие-то поля
    // для внешнего кода). Можно выкинуть и сам `response`, смотря
    // какой у вас контракт. Главное перевести код в ветку `catch`.
    const error = {
        status: response.status,
        customError: 'wtfAsync',
    };
    throw error;
}

// Загрузка данных через промисы (то же самое что `getDataAsync`)
function getDataPromise(url) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    }).then(
        (response) => {
            // Если мы тут, значит, запрос выполнился.
            // Но там может быть 404, 500, и т.д., поэтому проверяем ответ.
            if (response.ok) {
                return response.json();
            }
            // Пример кастомной ошибки (если нужно проставить какие-то поля
            // для внешнего кода). Можно зареджектить и сам `response`, смотря
            // какой у вас контракт. Главное перевести код в ветку `catch`.
            return Promise.reject({
                status: response.status,
                customError: 'wtfPromise',
            });
        },

        // При сетевой ошибке (мы оффлайн) из fetch вылетит эксцепшн,
        // и мы попадём в `onRejected` или в `.catch()` на промисе.
        // Если не добавить `onRejected` или `catch`, при ошибке будет
        // эксцепшн `Uncaught (in promise)`.
        (error) => {
            // Если не вернуть `Promise.reject()`, для внешнего кода
            // промис будет зарезолвлен с `undefined`, и мы не попадём
            // в ветку `catch` для обработки ошибок, а скорее всего
            // получим другой эксцепшн, потому что у нас `undefined`
            // вместо данных, с которыми мы работаем.
            return Promise.reject(error);
        }
    );
}

// Две функции просто для примера, выберите с await или promise, какая нравится
const getData = getDataAsync;
// || getDataPromise;

async function loadCountriesData() {
    let countries = [];
    try {
        // ПРОВЕРКА ОШИБКИ №1: ломаем этот урл, заменяя all на allolo,
        // получаем кастомную ошибку.
        countries = await getData(
            'https://restcountries.com/v3.1/all?fields=name&fields=cca3&fields=area&fields=borders'
        );
    } catch (error) {
        // console.log('catch for getData');
        // console.error(error);
        throw error;
    }
    return countries.reduce((result, country) => {
        result[country.cca3] = country;
        return result;
    }, {});
}

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');

(async () => {
    fromCountry.disabled = true;
    toCountry.disabled = true;
    submit.disabled = true;

    output.textContent = 'Loading…';
    let countriesData = {};
    try {
        // ПРОВЕРКА ОШИБКИ №2: Ставим тут брейкпоинт и, когда дойдёт
        // до него, переходим в оффлайн-режим. Получаем эксцепшн из `fetch`.
        countriesData = await loadCountriesData();
    } catch (error) {
        // console.log('catch for loadCountriesData');
        // console.error(error);
        output.textContent = 'Something went wrong. Try to reset your compluter.';
        return;
    }
    output.textContent = '';

    // Заполняем список стран для подсказки в инпутах
    Object.keys(countriesData)
        .sort((a, b) => countriesData[b].area - countriesData[a].area)
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code].name.common;
            countriesList.appendChild(option);
        });

    fromCountry.disabled = false;
    toCountry.disabled = false;
    submit.disabled = false;

    const getCountryCode = (countryName) => {
        const country = Object.values(countriesData).find((country) => country.name.common === countryName);
        if (country) {
            return country.cca3;
        }
        output.textContent = `Код страны ${countryName} не найден в countriesData`;
        return null;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        // TODO: Вывести, откуда и куда едем, и что идёт расчёт.
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.

        const from = fromCountry.value;
        const to = toCountry.value;
        const fromCode = getCountryCode(from);
        const toCode = getCountryCode(to);

        if (fromCode !== null && toCode !== null) {
            output.textContent = `Расчет маршрута из ${from} в ${to}`;
            output.style.whiteSpace = 'pre-line';
            output.textContent += '\n';
            const result = await calculateRoute(countriesData, fromCode, toCode);
            if (result.route.length > 10) {
                output.textContent += `Маршрут слишком длинный`;
            } else {
                Maps.setEndPoints(fromCode, toCode);
                Maps.markAsVisited(result.routeCodes.slice(1, -1));
                output.textContent += `${result.route.join(' → ')}`;
                output.style.whiteSpace = 'pre-line';
                output.textContent += '\n';
                output.textContent += `Понадобилось всего ${result.qCount} запросов!`;
            }
        }
    });
})();

const getCountryName = (countriesData, countryCode) => {
    const countryData = Object.entries(countriesData).find((data) => data[0] === countryCode);
    if (countryData) {
        return countryData[1].name.common;
    }
    output.textContent = `Страна ${countryCode} не найдена в countriesData`;
    return null;
};

// eslint-disable-next-line consistent-return
async function calculateRoute(countriesData, fromCode, toCode) {
    const queue = [];
    const visited = new Set();
    const parent = {};
    const route = [];
    const routeCodes = [];
    let qCount = 0;

    queue.push(fromCode);
    visited.add(fromCode);

    while (queue.length > 0) {
        const currentCode = queue.shift();
        const neighbors = countriesData[currentCode].borders;
        qCount += 1;

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
                visited.add(neighbor);
                parent[neighbor] = currentCode;
            }
        }
        if (currentCode === toCode) {
            let code = currentCode;
            while (code !== fromCode) {
                route.unshift(getCountryName(countriesData, code));
                routeCodes.unshift(code);
                code = parent[code];
            }
            route.unshift(getCountryName(countriesData, fromCode));
            routeCodes.unshift(fromCode);

            return {
                route,
                routeCodes,
                qCount,
            };
        }
    }
    output.textContent = 'Маршрут не найден';
}
