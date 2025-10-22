function parseTweets(runkeeper_tweets) {
	//Do not proceed if no tweets loaded
	if(runkeeper_tweets === undefined) {
		window.alert('No tweets returned');
		return;
	}

	tweet_array = runkeeper_tweets.map(function(tweet) {
		return new Tweet(tweet.text, tweet.created_at);
	});
	
	//This line modifies the DOM, searching for the tag with the numberTweets ID and updating the text.
	//It works correctly, your task is to update the text of the other tags in the HTML file!
	document.getElementById('numberTweets').innerText = tweet_array.length;

	// Earliest and latest tweet dates
	const times = tweet_array.map(t => t.time.getTime());
	const earliest = new Date(Math.min.apply(null, times));
	const latest = new Date(Math.max.apply(null, times));
	const dateFmtOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
	document.getElementById('firstDate').innerText = earliest.toLocaleDateString('en-US', dateFmtOpts);
	document.getElementById('lastDate').innerText = latest.toLocaleDateString('en-US', dateFmtOpts);

	// Category counts
	let completed = 0, live = 0, achieve = 0, misc = 0;
	for (const t of tweet_array) {
		switch (t.source) {
			case 'completed_event': completed++; break;
			case 'live_event': live++; break;
			case 'achievement': achieve++; break;
			default: misc++; break;
		}
	}
	const total = tweet_array.length || 1; // avoid div by zero
	const pct = (n) => (n * 100 / total).toFixed(2) + '%';

	// Update category spans (some classes appear more than once)
	// DOM update 
	function setAll(selector, value) {
  		const elements = document.querySelectorAll(selector);
  		elements.forEach(function(el) { el.innerText = String(value); });
	}
	setAll('.completedEvents', completed);
	setAll('.completedEventsPct', pct(completed));
	setAll('.liveEvents', live);
	setAll('.liveEventsPct', pct(live));
	setAll('.achievements', achieve);
	setAll('.achievementsPct', pct(achieve));
	setAll('.miscellaneous', misc);
	setAll('.miscellaneousPct', pct(misc));

	// Of completed events, how many included written text
	const completedTweets = tweet_array.filter(t => t.source === 'completed_event');
	const writtenCount = completedTweets.filter(t => t.written).length;
	const writtenPct = completedTweets.length ? (writtenCount * 100 / completedTweets.length).toFixed(2) + '%' : '0.00%';
	setAll('.written', writtenCount);
	setAll('.writtenPct', writtenPct);
}

function loadSavedRunkeeperTweets() {
	return new Promise(function(resolve, reject) {
		fetch('data/saved_tweets.json')
			.then(function(resp) {
				if (!resp.ok) throw new Error('Failed to load saved_tweets.json');
				return resp.json();
			})
			.then(function(json) {
				resolve(json);
			})
			.catch(function(err) {
				console.error(err);
				reject(err);
			});
	});
}

//Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function (event) {
	loadSavedRunkeeperTweets().then(parseTweets);
});