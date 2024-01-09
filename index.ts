import Maps from './maps.js';

interface CountryData {
    name: {
        common: string;
    };
    cca3: string;
    area: number;
    borders: string[];
}

// Загрузка данных через await
async function getDataAsync(url: string): Promise<CountryData[]> {
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
function getDataPromise(url: string): Promise<CountryData[]> {
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

const getData = getDataAsync;

async function loadCountriesData(){
    let countries: CountryData[] = [];
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
    return countries.reduce((result: { [code: string]: CountryData }, country) => {
        result[country.cca3] = country;
        return result;
    }, {});
}


const form = document.getElementById('form') as HTMLFormElement;
const fromCountry = document.getElementById('fromCountry') as HTMLSelectElement;
const toCountry = document.getElementById('toCountry') as HTMLSelectElement;
const countriesList = document.getElementById('countriesList') as HTMLSelectElement;
const submit = document.getElementById('submit') as HTMLButtonElement;
const output = document.getElementById('output') as HTMLDivElement;

(async () => {

    fromCountry.disabled = true;
    toCountry.disabled = true;
    submit.disabled = true;

    output.textContent = 'Loading…';
    let countriesData: { [code: string]: CountryData } = {};
    try {
        countriesData = await loadCountriesData();
    } catch (error) {
        output.textContent = 'Something went wrong. Try to reset your computer.';
        return;
    }

    output.textContent = '';

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


    const getCountryCode = (countryName: string): string | null => {

        const country = Object.values(countriesData).find(
            (country) => country.name.common === countryName
        );
        if (country) {
            return country.cca3;
        }
        output.textContent = `Код страны ${countryName} не найден в countriesData`;
        return null;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const from: string = fromCountry.value;
        const to: string = toCountry.value;
        const fromCode: string | null = getCountryCode(from);
        const toCode: string | null = getCountryCode(to);

        if (fromCode !== null && toCode !== null) {
            output.textContent = `Расчет маршрута из ${from} в ${to}`;
            output.style.whiteSpace = 'pre-line';
            output.textContent += '\n';
            const result = await calculateRoute(countriesData, fromCode, toCode);
            console.log("after calculateRoute");
            if (result !== undefined) {
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
            else output.textContent = 'Маршрут не найден';
        }

    });
})();


const getCountryName = (countriesData: { [code: string]: CountryData }, countryCode: string): string | null => {
    const countryData = Object.entries(countriesData).find((data) => data[0] === countryCode);
    if (countryData) {
        return countryData[1].name.common;
    }
    output.textContent = `Страна ${countryCode} не найдена в countriesData`;
    return null;
};


async function calculateRoute(
    countriesData: { [code: string]: CountryData },
    fromCode: string,
    toCode: string
) {

    const queue: string[] = [];
    const visited = new Set<string>();
    const parent: { [key: string]: string } = {};
    const route = [];
    const routeCodes = [];
    let qCount = 0;

    queue.push(fromCode);
    visited.add(fromCode);


    while (queue.length > 0) {
        const currentCode = queue.shift() as string;
        const neighbors = countriesData[currentCode].borders;
        qCount += 1;

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
                visited.add(neighbor);
                if (currentCode != null) {
                    parent[neighbor] = currentCode;
                }
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

}
