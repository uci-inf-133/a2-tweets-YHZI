// file loder
function loadSavedRunkeeperTweets() {
	return fetch('data/saved_tweets.json').then(function(resp){
		if (!resp.ok) throw new Error('Failed to load saved_tweets.json');
		return resp.json();
	});
}

function parseTweets(runkeeper_tweets) {
	//Do not proceed if no tweets loaded
	if(runkeeper_tweets === undefined) {
		window.alert('No tweets returned');
		return;
	}
	
	tweet_array = runkeeper_tweets.map(function(tweet) {
		return new Tweet(tweet.text, tweet.created_at);
	});

	// Consider only completed events for activity type and distance
	const completed = tweet_array.filter(t => t.source === 'completed_event');

	// Count activities
	const counts = new Map();
	for (const t of completed) {
		const a = t.activityType || 'unknown';
		counts.set(a, (counts.get(a) || 0) + 1);
	}
	const activityCounts = Array.from(counts.entries())
		.sort((a,b) => b[1]-a[1])
		.map(([activity, count]) => ({ activity, count }));

	// Top 3 activities (distance-based ones will bubble to top typically)
	const top3 = activityCounts.slice(0, 3).map(d => d.activity);

	// Build values for the first chart (use plain objects for Vega)
	const firstChartValues = completed.map(t => ({ activityType: t.activityType || 'unknown' }));

	activity_vis_spec = {
	  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
	  "description": "A graph of the number of Tweets containing each type of activity.",
			"data": {
				"values": firstChartValues
			}
	  //TODO: Add mark and encoding
	  ,
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
	vegaEmbed('#activityVis', activity_vis_spec, {actions:false});

	// Prepare per-activity distances with day of week for top3
	function dayOfWeek(d){
		return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
	}
	const top3Data = completed
		.filter(t => top3.includes(t.activityType))
		.map(t => ({
			activity: t.activityType,
			distance: t.distance,
			day: dayOfWeek(t.time)
		}))
		.filter(d => d.distance > 0);

	// Single-chart toggle via re-embedding: render raw or mean into the same container
	function getDistanceSpec(aggregate) {
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

	let showingMean = false;
	function renderDistance() {
		const spec = getDistanceSpec(showingMean);
		vegaEmbed('#distanceVis', spec, { actions: false }).catch(function(err){ console.error(err); });
	}
	renderDistance();

	const btn = document.getElementById('aggregate');
	function setButtonLabel() {
		if (btn) btn.textContent = showingMean ? 'Show raw values' : 'Show means';
	}
	setButtonLabel();
	if (btn) {
		btn.addEventListener('click', function(){
			showingMean = !showingMean;
			renderDistance();
			setButtonLabel();
		});
	}

	// DOM updates for number of activity types and top three frequent types
	const numEl = document.getElementById('numberActivities');
	if (numEl) numEl.innerText = String(activityCounts.length);
	if (activityCounts[0]) document.getElementById('firstMost').innerText = activityCounts[0].activity;
	if (activityCounts[1]) document.getElementById('secondMost').innerText = activityCounts[1].activity;
	if (activityCounts[2]) document.getElementById('thirdMost').innerText = activityCounts[2].activity;

	// Longest/shortest average distance among top3
	function avgByActivity(data) {
		const m = new Map();
		for (const d of data) {
			const prev = m.get(d.activity) || {sum:0, n:0};
			m.set(d.activity, {sum: prev.sum + d.distance, n: prev.n + 1});
		}
		return Array.from(m, ([activity, {sum, n}]) => ({activity, avg: n ? sum/n : 0}));
	}
	
	const avgs = avgByActivity(top3Data).sort((a,b)=>b.avg-a.avg);
	if (avgs.length) {
		document.getElementById('longestActivityType').innerText = avgs[0].activity;
		document.getElementById('shortestActivityType').innerText = avgs[avgs.length-1].activity;
	}

	// Weekday vs weekend: which tends to have longer activities (averaged across top3)
	function isWeekend(d){ return d==='Sat' || d==='Sun'; }
	const wk = {sum:0,n:0}; const we = {sum:0,n:0};
	for (const d of top3Data) {
		if (isWeekend(d.day)) { we.sum += d.distance; we.n++; }
		else { wk.sum += d.distance; wk.n++; }
	}
	const wkAvg = wk.n ? wk.sum/wk.n : 0;
	const weAvg = we.n ? we.sum/we.n : 0;
	document.getElementById('weekdayOrWeekendLonger').innerText = (weAvg > wkAvg) ? 'weekends' : 'weekdays';

	// Hide the old aggregated container (we now use a single chart)
	const oldAgg = document.getElementById('distanceVisAggregated');
	if (oldAgg) oldAgg.style.display = 'none';
}

//Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function (event) {
	loadSavedRunkeeperTweets().then(parseTweets).catch(function(err){
		console.error(err);
		window.alert('Failed to load tweets: ' + err.message);
	});
});