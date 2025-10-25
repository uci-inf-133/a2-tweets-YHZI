// file loder
function loadSavedRunkeeperTweets() {
	return fetch('data/saved_tweets.json').then(function(resp){
		if (!resp.ok) throw new Error('Failed to load saved_tweets.json');
		return resp.json();
	});
}

// ----- Helpers: data preparation -----
function toTweetArray(runkeeper_tweets){
	return runkeeper_tweets.map(function(tweet) {
		return new Tweet(tweet.text, tweet.created_at);
	});
}

function filterCompleted(tweets){
	return tweets.filter(t => t.source === 'completed_event');
}

function computeActivityCounts(completed){
	const counts = new Map();
	for (const t of completed) {
		const a = t.activityType || 'unknown';
		counts.set(a, (counts.get(a) || 0) + 1);
	}
	return Array.from(counts.entries())
		.sort((a,b) => b[1]-a[1])
		.map(([activity, count]) => ({ activity, count }));
}

function computeTop3Activities(activityCounts){
	return activityCounts.slice(0, 3).map(d => d.activity);
}

function firstChartValuesFrom(completed){
	return completed.map(t => ({ activityType: t.activityType || 'unknown' }));
}

// ----- Helpers: charts/specs -----
function buildActivityBarSpec(values){
	return {
		"$schema": "https://vega.github.io/schema/vega-lite/v5.json",
		"description": "A graph of the number of Tweets containing each type of activity.",
		"data": { "values": values },
		"mark": "bar",
		"encoding": {
			"x": { "field": "activityType", "type": "nominal", "sort": "-y", "title": "Activity Type" },
			"y": { "aggregate": "count", "type": "quantitative", "title": "Tweets" },
			"tooltip": [
				{ "field": "activityType", "type": "nominal" },
				{ "aggregate": "count", "type": "quantitative", "title": "Tweets" }
			]
		}
	};
}

function dayOfWeek(d){
	return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
}

function buildTop3Data(completed, top3){
	return completed
		.filter(t => top3.includes(t.activityType))
		.map(t => ({
			activity: t.activityType,
			distance: t.distance,
			day: dayOfWeek(t.time)
		}))
		.filter(d => d.distance > 0);
}

function getDistanceSpec(top3Data, aggregate){
	return {
		"$schema": "https://vega.github.io/schema/vega-lite/v5.json",
		"description": aggregate
			? "Mean distance by day of the week for top 3 activities."
			: "Distances by day of the week for the three most tweeted-about activities.",
		"data": { "values": top3Data },
		"mark": { "type": "point", "opacity": aggregate ? 1 : 0.4, "filled": aggregate },
		"encoding": {
			"x": { "field": "day", "type": "ordinal", "sort": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], "title": "Day of Week" },
			"y": aggregate
				? { "aggregate": "mean", "field": "distance", "type": "quantitative", "title": "Mean Distance (mi)" }
				: { "field": "distance", "type": "quantitative", "title": "Distance (mi)" },
			"color": { "field": "activity", "type": "nominal", "title": "Activity" },
			"tooltip": aggregate
				? [ { "field": "activity" }, { "field": "day" }, { "aggregate": "mean", "field": "distance", "type": "quantitative" } ]
				: [ { "field": "activity" }, { "field": "day" }, { "field": "distance", "type": "quantitative" } ]
		}
	};
}

function renderDistanceChart(top3Data, showingMean){
	const spec = getDistanceSpec(top3Data, showingMean);
	return vegaEmbed('#distanceVis', spec, { actions: false }).catch(function(err){ console.error(err); });
}

// ----- Helpers: DOM and summary -----
function setAggregateButtonLabel(btn, showingMean){
	if (btn) btn.textContent = showingMean ? 'Show raw values' : 'Show means';
}

function initAggregateToggle(btnId, initial, onToggle){
	const btn = document.getElementById(btnId);
	let state = !!initial;
	setAggregateButtonLabel(btn, state);
	if (btn) {
		btn.addEventListener('click', function(){
			state = !state;
			setAggregateButtonLabel(btn, state);
			onToggle(state);
		});
	}
	return { get value(){ return state; } };
}

function avgByActivity(data) {
	const m = new Map();
	for (const d of data) {
		const prev = m.get(d.activity) || {sum:0, n:0};
		m.set(d.activity, {sum: prev.sum + d.distance, n: prev.n + 1});
	}
	return Array.from(m, ([activity, {sum, n}]) => ({activity, avg: n ? sum/n : 0}));
}

function updateSummaryDom(activityCounts, top3Data){
	const numEl = document.getElementById('numberActivities');
	if (numEl) numEl.innerText = String(activityCounts.length);
	if (activityCounts[0]) document.getElementById('firstMost').innerText = activityCounts[0].activity;
	if (activityCounts[1]) document.getElementById('secondMost').innerText = activityCounts[1].activity;
	if (activityCounts[2]) document.getElementById('thirdMost').innerText = activityCounts[2].activity;

	const avgs = avgByActivity(top3Data).sort((a,b)=>b.avg-a.avg);
	if (avgs.length) {
		document.getElementById('longestActivityType').innerText = avgs[0].activity;
		document.getElementById('shortestActivityType').innerText = avgs[avgs.length-1].activity;
	}
}

function updateWeekdayWeekendDom(top3Data){
	function isWeekend(d){ return d==='Sat' || d==='Sun'; }
	const wk = {sum:0,n:0}; const we = {sum:0,n:0};
	for (const d of top3Data) {
		if (isWeekend(d.day)) { we.sum += d.distance; we.n++; }
		else { wk.sum += d.distance; wk.n++; }
	}
	const wkAvg = wk.n ? wk.sum/wk.n : 0;
	const weAvg = we.n ? we.sum/we.n : 0;
	document.getElementById('weekdayOrWeekendLonger').innerText = (weAvg > wkAvg) ? 'weekends' : 'weekdays';
}

function hideLegacy(){
	const oldAgg = document.getElementById('distanceVisAggregated');
	if (oldAgg) oldAgg.style.display = 'none';
}

function parseTweets(runkeeper_tweets) {
	//Do not proceed if no tweets loaded
	if(runkeeper_tweets === undefined) {
		window.alert('No tweets returned');
		return;
	}
    
	// 1) Map to Tweet objects and select completed events
	tweet_array = toTweetArray(runkeeper_tweets); // keep global for compatibility
	const completed = filterCompleted(tweet_array);

	// 2) Activity counts and Top3
	const activityCounts = computeActivityCounts(completed);
	const top3 = computeTop3Activities(activityCounts);

	// 3) First chart (activity type counts)
	const firstChartValues = firstChartValuesFrom(completed);
	activity_vis_spec = buildActivityBarSpec(firstChartValues); // keep global name
	vegaEmbed('#activityVis', activity_vis_spec, {actions:false});

	// 4) Distance scatter with toggle (raw vs mean)
	const top3Data = buildTop3Data(completed, top3);
	let showingMean = false;
	renderDistanceChart(top3Data, showingMean);
	initAggregateToggle('aggregate', showingMean, function(state){
		showingMean = state;
		renderDistanceChart(top3Data, showingMean);
	});

	// 5) Summary DOM updates
	updateSummaryDom(activityCounts, top3Data);
	updateWeekdayWeekendDom(top3Data);

	// 6) Cleanup legacy containers
	hideLegacy();
}

//Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function (event) {
	loadSavedRunkeeperTweets().then(parseTweets).catch(function(err){
		console.error(err);
		window.alert('Failed to load tweets: ' + err.message);
	});
});