import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import path from "path";
import { basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

const API_URL = "http://api.openweathermap.org/geo/1.0/direct";
const API_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const API_5_day_3_hour_forecast = "https://api.openweathermap.org/data/2.5/forecast";
// free API key with limitaion 60 calls/minute --> 1,000,000 calls/month
const API_KEY = "3c5666ec7e7512d923b63f364173f906";

app.get("/", async (req, res) => {

    res.render("index.ejs");
});

app.post("/", async (req, res) => {
    let place = req.body.place;
    // console.log(place);

    try {
        // Get geocoding data from API 
        const geocoding_result = await axios.get(API_URL, {
            params: {
                q: req.body.place,
                appid: API_KEY,
            }
        });

        // Extract latitude and longitude 
        let latitude = geocoding_result.data[0]["lat"];
        let longitude = geocoding_result.data[0]["lon"];

        //  Get current weather data from API
        const this_moment_weather_result = await axios.get(API_WEATHER_URL, {
            params: {
                lat: latitude,
                lon: longitude,
                appid: API_KEY,
                units: "metric",
            }
        });

        // Extract and prepare current weather data to send to the all_data() function 
        let current_weather_data = this_moment_weather_result.data;
        let obj;

        // Extract GMT date from geocoding data
        let GMT_time_string = geocoding_result.headers.date
        // console.log("GMT Time String: " + GMT_time_string);

        // Convert GMT date for local user date
        let actuall_date = new Date(GMT_time_string);

        // Extract timezone of location (Shift in seconds from UTC)
        let timezone_of_location = this_moment_weather_result.data.timezone

        // Convert actuall user time to actuall time in chosen location
        let current_weather_location_date = convert_location_time(timezone_of_location, GMT_time_string)

        // Create a variable this_moment_weather to which it assigns the object created
        // after processing the data by the all_data() functions which is prepared
        // to render it on the index.ejs
        let this_moment_weather = all_data(obj, current_weather_data, actuall_date, current_weather_location_date);

        // Create checked_place variable to check if the name of place exist in english in database,
        // if not write a basic name (usually in local language) 
        let checked_place;
        if (geocoding_result.data[0].local_names.en) {
            checked_place = geocoding_result.data[0].local_names.en;
        } else {
            checked_place = geocoding_result.data[0].name;
        };

        // Create an place_data object to render it on the index.ejs 
        let place_data_obj = {
            place: checked_place,
            latitude: geocoding_result.data[0]["lat"],
            longitude: geocoding_result.data[0]["lon"],
            country_shortcut: geocoding_result.data[0].country,
        }

        //  Get 5 day weather forecast data from API 
        // (it includes weather forecast data with 3-hour step)
        const forecast_5_day_3_hour_result = await axios.get(API_5_day_3_hour_forecast, {
            params: {
                lat: latitude,
                lon: longitude,
                appid: API_KEY,
                units: "metric",
            }
        });

        // Extract and prepare forecast data to send to the all_data() function in forEach loop
        let forecast_data = forecast_5_day_3_hour_result.data.list
        let array_of_forecast = [];
        let obj_forecast;

        forecast_data.forEach(element => {
            let GMT_date = element.dt_txt + " GMT"

            // Convert actuall forecast date to actuall forecast date in chosen location
            let forecast_location_date = convert_location_time(timezone_of_location, GMT_date)

            // Actuall forecast date (user date)
            let forecast_date = new Date(GMT_date);

            // Push all prepared objects (of forecast data) to the array_of_forecast array 
            // after processing the data by the all_data() 
            // function which is prepared to render it on the index.ejs 
            array_of_forecast.push(all_data(obj_forecast, element, forecast_date, forecast_location_date))
        });

        // Render all prepared objects and array to index.ejs
        res.render("index.ejs", {
            this_moment_weather_data: this_moment_weather,
            forecast_data: array_of_forecast,
            place_data: place_data_obj,
        });

        // If such a place that user send does't exist in the database or happens any error, renders error message to index.ejs
    } catch (error) {
        console.error("Failed to make request: ", error.message);
        res.render("index.ejs", {
            error: error.message,
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

function all_data(object, path, date, location_date) {
    object = {
        actuall_date: date.toLocaleString(),
        actuall_location_date: location_date,
        actuall_temp: path.main.temp + " °C",
        temp_min: path.main.temp_min + " °C",
        temp_max: path.main.temp_max + " °C",
        pressure: path.main.pressure + " hPa",
        wind_speed: path.wind.speed + "  meter/sec",
        wind_direction: path.wind.deg + " degrees (meteorological)",
        cloudiness: path.clouds.all + " %",
        pop: path.pop,
        rain: path.rain,
        icon: path.weather[0]["icon"],
    }
    return object;
}

function convert_location_time(timezone, GMT_time_str) {

    let GMT_time_date = new Date(Date.parse(GMT_time_str));
    let local_time_in_location = new Date(GMT_time_date.getTime() + (timezone * 1000));
    let local_time_in_location_to_modife = JSON.stringify(local_time_in_location);

    let y = local_time_in_location_to_modife.split("T")
    // console.log(y)
    y[1] = y[1].split(".")
    // console.log(y)
    let location_time = [y[0], y[1][0]]
    location_time[0] = location_time[0].substring(1);
    location_time = location_time.reverse()

    let p = location_time[1].split("-")
    p = p.reverse()
    let date = "";
    p.forEach(element => {
        date += element + "."
    });

    date = date.slice(0, -1)

    let finall_location_date_with_time = date + ", " + location_time[0]

    if (finall_location_date_with_time[0] === "0") {
        finall_location_date_with_time = finall_location_date_with_time.slice(1)
    }
    return finall_location_date_with_time
};