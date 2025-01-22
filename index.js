import fetch from "node-fetch";
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs/promises";
import crypto from "crypto";
dotenv.config();

const EMAIL = process.env.SILENCIO_EMAIL;
const PASSWORD = process.env.SILENCIO_PASSWORD;
const BASE_LAT = process.env.BASE_LAT || "-6.1824183";
const BASE_LONG = process.env.BASE_LONG || "106.830235";
const TOKEN_FILE = "auth_token.json";

function generateHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('base64');
}

const headers = {
    'Host': 'api.silencio.store',
    'Content-Type': 'application/json; charset=UTF-8',
    'User-Agent': 'okhttp/4.12.0'
};

function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function generateNearbyCoordinate(baseLat, baseLong) {
    const latVariation = (Math.random() < 0.5 ? -1 : 1) * getRandomInRange(0.00001, 0.0001);
    const longVariation = (Math.random() < 0.5 ? -1 : 1) * getRandomInRange(0.00001, 0.0001);
    return {
        lat: (parseFloat(baseLat) + latVariation).toFixed(7),
        long: (parseFloat(baseLong) + longVariation).toFixed(7),
    };
}

function generateDbValue() {
    return getRandomInRange(39, 78);
}

function displayRewardsLog(data) {
    console.log(chalk.green("🎉 Recording Rewards Summary:"));
    console.log(chalk.yellow("==========================================="));
    console.log(`${chalk.bold("Status:")} ${data.isProcessed ? chalk.green("Processed") : chalk.red("Not Processed")}`);
    console.log(`${chalk.bold("Total Coins Earned:")} ${chalk.green(data.totalCoin.toFixed(4))}`);
    console.log(`${chalk.bold("Recording Length:")} ${chalk.blue(data.length)} seconds`);
    console.log(`${chalk.bold("Cover:")} ${chalk.blue(data.cover)} (${chalk.green(data.coverCoin.toFixed(4))} coins)`);
    console.log(`${chalk.bold("Discover:")} ${chalk.blue(data.discover)} (${chalk.green(data.discoverCoin.toFixed(4))} coins)`);
    console.log(`${chalk.bold("Open Coins:")} ${chalk.green(data.openCoin.toFixed(4))}`);
    console.log(`${chalk.bold("Streak Day:")} ${chalk.blue(data.streakDay)} (${chalk.green(data.streakCoin.toFixed(4))} coins)`);
    console.log(`${chalk.bold("Streak Percentage Bonus:")} ${chalk.blue(data.streakPercentage)}%`);
    console.log(`${chalk.bold("First Venue Check-in Bonus:")} ${chalk.green(data.firstVenueBonus.toFixed(4))}`);
    console.log(chalk.yellow("==========================================="));
}

async function saveToken(token) {
    try {
        await fs.writeFile(TOKEN_FILE, JSON.stringify({ token, timestamp: Date.now() }));
        console.log(chalk.green("✅ Token saved successfully"));
    } catch (error) {
        console.error(chalk.red("❌ Error saving token:"), error);
    }
}

async function loadToken() {
    try {
        const data = await fs.readFile(TOKEN_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log(chalk.yellow("⚠️ No saved token found"));
        return null;
    }
}

async function login() {
    console.log(chalk.blue("🔑 Logging in..."));

    try {
        const loginData = {
            deviceToken: "",
            deviceType: "android",
            nickName: EMAIL,
            password: PASSWORD
        };

        const loginHeaders = {
            ...headers,
            'X-Hash': generateHash(JSON.stringify(loginData))
        };

        const response = await fetch('https://api.silencio.store/v2/user/auth/login', {
            method: 'POST',
            headers: loginHeaders,
            body: JSON.stringify(loginData)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();

        if (result.status === 200) {
            console.log(chalk.green("✅ Login successful"));
            await saveToken(result.data.authToken);
            return result.data.authToken;
        } else {
            throw new Error(result.message || "Login failed");
        }
    } catch (error) {
        console.error(chalk.red("❌ Login error:"), error);
        throw error;
    }
}

async function getValidToken() {
    const savedToken = await loadToken();

    if (savedToken) {
        return savedToken.token;
    }

    return await login();
}

async function claimReward(token, sampleId) {
    console.log(chalk.blue("💰 Claiming reward..."));

    try {
        const claimData = {
            earnedAmount: 1000,
            sampleId
        };

        const claimHeaders = {
            ...headers,
            'X-Auth': token,
            'X-Hash': generateHash(JSON.stringify(claimData))
        };

        const response = await fetch('https://api.silencio.store/v2/user/recording/open-claim-coin', {
            method: 'POST',
            headers: claimHeaders,
            body: JSON.stringify(claimData)
        });

        if (!response.ok) {
            const errorResponse = await response.text();
            console.error(chalk.red("❌ Claim reward response error:"), errorResponse);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log(chalk.green("✅ Reward claimed successfully!"));
        // console.log(chalk.yellow("🏆 Claim Result:"), JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error(chalk.red("❌ Claim reward error:"), error);
        throw error;
    }
}


async function startRecording(token) {
    console.log(chalk.blue("🎙️ Starting recording..."));

    try {
        const { lat, long } = generateNearbyCoordinate(BASE_LAT, BASE_LONG);

        const startData = {
            adId: "76531337-e7f0-4687-a748-09bd5ad22239",
            idType: "Android",
            ipAddress: "127.0.0.1",
            isoCountryCode: "id",
            measurementType: "open",
            startLocation: {
                accuracy: 5.0,
                coordinates: [long, lat],
                type: "Point"
            }
        };

        const startHeaders = {
            ...headers,
            'X-Auth': token,
            'X-Hash': generateHash(JSON.stringify(startData))
        };

        const response = await fetch('https://api.silencio.store/v2/user/recording/start', {
            method: 'POST',
            headers: startHeaders,
            body: JSON.stringify(startData)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();

        if (result.status === 200) {
            console.log(chalk.green("✅ Recording started successfully"));
            return { sampleId: result.data.createdData.id, startTime: Date.now() };
        } else {
            throw new Error(result.message || "Failed to start recording");
        }
    } catch (error) {
        console.error(chalk.red("❌ Start recording error:"), error);
        throw error;
    }
}

async function sendHexagonHit(token, sampleId, duration) {
    console.log(chalk.blue("📡 Sending hexagon hit dynamically..."));

    for (let i = 1; i <= duration; i++) {
        try {
            const coordinates = Array.from({ length: i }, () => {
                const { lat, long } = generateNearbyCoordinate(BASE_LAT, BASE_LONG);
                return {
                    accuracy: 5.0,
                    coordinate: [long, lat], // Longitude first, then latitude
                    dbValue: generateDbValue()
                };
            });

            const hexagonData = {
                coordinateArray: coordinates,
                sampleId
            };

            const hexagonHeaders = {
                ...headers,
                'X-Auth': token,
                'X-Hash': generateHash(JSON.stringify(hexagonData))
            };

            const response = await fetch('https://api.silencio.store/v2/user/map/get-hexagon', {
                method: 'POST',
                headers: hexagonHeaders,
                body: JSON.stringify(hexagonData)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            console.log(chalk.green(`✅ Hexagon hit sent for second ${i} successfully`));
        } catch (error) {
            console.error(chalk.red(`❌ Hexagon hit error for second ${i}:`), error);
            // Continue sending for subsequent seconds even if one fails
        }

        // Delay 1 second before sending the next batch
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(chalk.green("📡 All hexagon hits completed."));
}


async function stopRecording(token, sampleId, startTime, duration) {
    console.log(chalk.blue("🛑 Stopping recording..."));

    try {
        const recordingData = Array.from({ length: duration }, (_, i) => {
            const { lat, long } = generateNearbyCoordinate(BASE_LAT, BASE_LONG);
            return {
                accuracy: 5.0,
                dbValue: generateDbValue(),
                location: {
                    accuracy: 5.0,
                    coordinates: [long, lat],
                    type: "Point"
                },
                timeStamp: startTime + i * 1000
            };
        });

        const endLocation = {
            accuracy: 5.0,
            coordinates: [
                recordingData[recordingData.length - 1].location.coordinates[0],
                recordingData[recordingData.length - 1].location.coordinates[1]
            ],
            type: "Point"
        };

        const stopData = {
            avgDb: recordingData.reduce((sum, rec) => sum + rec.dbValue, 0) / recordingData.length,
            endLocation,
            endTime: startTime + duration * 1000,
            length: duration,
            maxDb: Math.max(...recordingData.map(rec => rec.dbValue)),
            minDb: Math.min(...recordingData.map(rec => rec.dbValue)),
            sampleId,
            voiceRecording: recordingData
        };

        const stopHeaders = {
            ...headers,
            'X-Auth': token,
            'X-Hash': generateHash(JSON.stringify(stopData))
        };

        const response = await fetch('https://api.silencio.store/v2/user/recording/stop', {
            method: 'POST',
            headers: stopHeaders,
            body: JSON.stringify(stopData)
        });

        if (!response.ok) {
            const errorResponse = await response.text();
            console.error(chalk.red("❌ Server response error:"), errorResponse);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log(chalk.green("✅ Recording stopped successfully"));
        return result;
    } catch (error) {
        console.error(chalk.red("❌ Stop recording error:"), error);
        throw error;
    }
}


async function getRecordingDetails(token, sampleId) {
    console.log(chalk.blue("📋 Fetching recording details..."));

    try {
        const detailsData = {
            sampleId
        };

        const detailsHeaders = {
            ...headers,
            'X-Auth': token,
            'X-Hash': generateHash(JSON.stringify(detailsData))
        };

        const response = await fetch('https://api.silencio.store/v2/user/recording/details', {
            method: 'POST',
            headers: detailsHeaders,
            body: JSON.stringify(detailsData)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        console.log(chalk.green("✅ Recording details fetched successfully"));
        // displayRewardsLog(result.data);
        return result.data;
    } catch (error) {
        console.error(chalk.red("❌ Fetch recording details error:"), error);
        throw error;
    }
}

async function performRecordingCycle() {
    try {
        const token = await getValidToken();
        const { sampleId, startTime } = await startRecording(token);

        const duration = Math.floor(getRandomInRange(10, 89));
        console.log(chalk.yellow(`⏳ Recording for ${duration} seconds...`));
        await sendHexagonHit(token, sampleId, duration);

        await stopRecording(token, sampleId, startTime, duration);
        await claimReward(token, sampleId);
        const rewards = await getRecordingDetails(token, sampleId);
        displayRewardsLog(rewards);
    } catch (error) {
        console.error(chalk.red("❌ Error in recording cycle:"), error);
    }
}

async function main() {
    console.log(chalk.blue("\n🤖 Starting Bot in Loop Mode..."));
    while (true) {
        await performRecordingCycle();
        const waitTime = Math.floor(getRandomInRange(10, 20));
        console.log(chalk.blue(`⏳ Waiting for ${waitTime} seconds before next cycle...\n`));
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
}

main().catch(error => console.error(chalk.red("❌ Fatal Error:"), error));