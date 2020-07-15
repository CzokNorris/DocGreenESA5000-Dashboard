var isLightOn = false;
var isEcoModeOn = false;
var isLockOn = false;

function handleError(err)
{
	console.error(err);
	// TODO: show to user
}

document.body.onload = function()
{
	var speedGauge = new RadialGauge({
		renderTo: 'speed-gauge',
		width: 400,
		height: 400,
		units: 'km/h',

		title: false,
		borders: false,
		colorPlate: 'rgba(255, 255, 255, 0)',
		animationRule: 'linear',
		animationDuration: 200,

		value: 0,
		valueBox: false,
		minValue: 0,
		maxValue: 35,

		startAngle: 0,
		ticksAngle: 180,

		majorTicks: [
			'0','5','10','15','20','25','30','35'
		],
		minorTicks: 5,
		strokeTicks: false,
		highlights: [
			{ from: 20, to: 35, color: 'rgba(255,0,0,.5)' }
		],

		colorNeedle: '#f00',
		colorNeedleEnd: '#f00',
		needleShadow: false,
	});

	var batteryGauge = new RadialGauge({
		renderTo: 'battery-gauge',
		width: 400,
		height: 400,

		title: false,
		borders: false,

		value: 0,
		valueBox: false,
		minValue: 0,
		maxValue: 100,

		startAngle: 280,
		ticksAngle: 70,

		majorTicks: [
			'0','20','40','60','80','100',
		],
		minTicks: 1,
		highlights: [
			{ from: 80, to: 100, color: 'rgba(0,255,0,.5)' },
			{ from: 60, to: 80, color: 'rgba(0,255,0,.4)' },
			{ from: 40, to: 60, color: 'rgba(0,255,0,.3)' },
			{ from: 20, to: 40, color: 'rgba(0,255,0,.2)' },
			{ from: 0, to: 20, color: 'rgba(0,255,0,.1)' },
		],
		colorPlate: 'rgba(255, 255, 255, 0)',
		animationRule: 'linear',
		animationDuration: 0,

		needleType: 'line',
		needleWidth: 2,
		needleStart: 80,
		needleEnd: 90,
		colorNeedle: '#f00',
		colorNeedleEnd: '#f00',
		needleShadow: false,
	});

	var accelerationGauge = new RadialGauge({
		renderTo: 'acceleration-gauge',
		width: 400,
		height: 400,

		title: false,
		borders: false,

		value: 0,
		valueBox: false,
		minValue: -1,
		maxValue: 1,

		startAngle: 190,
		ticksAngle: 80,

		majorTicks: [
			'-1','-0.5','0','0.5','1',
		],
		minTicks: 3,
		highlights: [
			{ from: -1, to: 0, color: 'rgba(0,255,0,.5)' },
			{ from: 0, to: 1, color: 'rgba(255,0,0,.5)' },
		],
		colorPlate: 'rgba(255, 255, 255, 0)',
		animationRule: 'linear',
		animationDuration: 200,

		needleType: 'line',
		needleWidth: 2,
		needleStart: 80,
		needleEnd: 90,
		colorNeedle: '#00f',
		colorNeedleEnd: '#00f',
		needleShadow: false,
	});

	function updateStatusSpan(id, status)
	{
		var el = document.getElementById(id);
		el.innerText = status ? "ON" : "OFF";
	}

	function updateData()
	{
		fetch('/data')
			.then(res => res.json())
			.then(data => {

				isLightOn = !!data.lights;
				isEcoModeOn = !!data.ecoMode;
				isLockOn = !!data.isLocked;

				updateStatusSpan("light-status", isLightOn);
				updateStatusSpan("eco-status", isEcoModeOn);
				updateStatusSpan("lock-status", isLockOn);

				speedGauge.value = data.speed;
				batteryGauge.value = data.soc;

				var throttle = data.throttle;
				var brake = data.brake;
				if(brake > throttle)
					accelerationGauge.value = -1 * (brake - 0x2C) / (0xB5 - 0x2C);
				else
					accelerationGauge.value = (throttle - 0x2C) / (0xC5 - 0x2C);

			})
			.catch(handleError)
			.then(() => setTimeout(updateData, 200));
	}

	updateData();
};

function doAction(name, value)
{
	fetch("/action/" + name + "/" + value)
		.catch(handleError);
}

function toggleLight()
{
	doAction("setLight", !isLightOn);
}
function toggleEcoMode()
{
	doAction("setEcoMode", !isEcoModeOn);
}
function toggleLock()
{
	doAction("setLock", !isLockOn);
}
function configureMaxSpeed(speed)
{
	doAction("setMaxSpeed", speed);
	document.getElementById("max-speed").innerText = speed;
}