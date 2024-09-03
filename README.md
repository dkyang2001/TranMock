# Brief Introduction

This app was created as mock-up of a bus tracker app called **Transloc**. 

<img width="318" alt="Screenshot 2024-09-03 at 3 33 15 PM" src="https://github.com/user-attachments/assets/124f8216-0208-4acd-a2e1-b868d113af9f">


The web app is public and free to use, and its main target audience are Charlottesville residents. One difference from the original transloc app is it also includes Charlottesville area transit routes along with UVA UTS routes. App contains all live data of the routes including live location/heading of vehicles, arrival estimates, and schedules.

***The App was creating using Maplibre and CARTO style tiles***

## Features

### 1. GPS Tracking

Using Geolocation api and Device Orientation event, the app allows user to click on the Compass button and locate where they are relative to the routes/vehicles with great accuracy. While Geolocation API is widely supported in all browsers regardless of the operating system of the device, device orientations had to be implemented differently on each browser types. (Heading feature disabled temporarily due to IOS requesting permission twice for GPS and Gyroscope). Inner mechanisms of how android/ios utilizes the APIs is listed below: 

<img width="318" alt="Screenshot 2024-09-03 at 3 34 01 PM" src="https://github.com/user-attachments/assets/6100bc80-91e7-4ba3-9845-e5c98c4c3419">

#### - Android

Currently, all android with chromium browsers allows deviceorientationabsolute event and shows great accuracy on the absolute alpha value(device heading). For android devices, it doesn't require any permission to activate the gyroscope sensor and is tested to work on both android chrome and samsung interent.

#### - IOS

IOS requires user to grant permission(**DeviceOrientationEvent.requestPermission()**) on gyroscope sensor which also needs to be prompted from a user event such as click/touch. The app retrieves device information using Navigator useragent information provided from the browser and checks the type of device using regex. It then uses webkitCompassHeading to get the device heading. 

### 2. Route toggle Activation

App allows activation and hiding of routes from the main map. Click on the route button in the left middle of each route from the route list and users can decide which routes they want to view.

<img width="415" alt="Screenshot 2024-09-03 at 4 08 21 PM" src="https://github.com/user-attachments/assets/aa29b24f-e445-4656-8f3f-b9f39ec4e7e1">

### 3. Pop up

Upon clicking on a route from the route list, the app takes the user to a popup showing a focused view of the route and current route&stop specific live data within the sidebar. Data includes how far the user is away from the stop(**if GPS is on**), Complete list of arrival estimates, and Schedules for the stop if it exists in the api.(CAT routes support it)

<img width="313" alt="Screenshot 2024-09-03 at 4 05 19 PM" src="https://github.com/user-attachments/assets/49c27a1d-083a-430c-85de-d9438443a4e4">

### 4. Favorites

Using local storage, the app can store users' favorited routes in the browser and retrieve the info when user reopens the web app. Upon clicking the heart button within popUp, the route is activated and will show up at the top of the list in the main page.

<img width="828" alt="Screenshot 2024-09-03 at 3 58 31 PM" src="https://github.com/user-attachments/assets/59dee93b-f01c-4ee7-8cb0-2c0683735346">

## Info about backend and API usages


Info for backend server will be covered in the backend github repo: 




