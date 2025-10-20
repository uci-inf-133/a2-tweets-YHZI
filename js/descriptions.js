let writtenTweets = [];

function parseTweets(runkeeper_tweets) {
	//Do not proceed if no tweets loaded
	if (runkeeper_tweets === undefined) {
		window.alert('No tweets returned');
		return;
	}

	// Map to Tweet objects and keep only user-written tweets
	const tweet_array = runkeeper_tweets.map(function (tweet) {
		return new Tweet(tweet.text, tweet.created_at);
	});
	writtenTweets = tweet_array.filter(t => t.written);

	// Initial render using whatever is in the input box
	const input = document.getElementById('textFilter');
	const q = input && 'value' in input ? input.value : '';
	updateSearchResults(q);
}

function updateSearchResults(filterText) {
	const tbody = document.getElementById('tweetTable');
	const countSpan = document.getElementById('searchCount');
	const textSpan = document.getElementById('searchText');
	if (!tbody) return;

	const q = (filterText || '').trim();
	// Update header spans
	if (textSpan) textSpan.innerText = q;

	if (q.length === 0) {
		// Clear table and count when query is empty
		tbody.innerHTML = '';
		if (countSpan) countSpan.innerText = '0';
		return;
	}

	const qLower = q.toLowerCase();
	const matches = writtenTweets.filter(t => (t.writtenText || '').toLowerCase().includes(qLower));
	if (countSpan) countSpan.innerText = String(matches.length);

	// Build rows with clickable links via Tweet.getHTMLTableRow
	const rowsHtml = matches.map((t, i) => t.getHTMLTableRow(i + 1)).join('');
	tbody.innerHTML = rowsHtml;
}

function addEventHandlerForSearch() {
	const input = document.getElementById('textFilter');
	if (!input) return;
	input.addEventListener('input', function (e) {
		const val = e && e.target && 'value' in e.target ? e.target.value : '';
		updateSearchResults(val);
	});
}

// Provide a local loader fallback if the external file is missing or broken
if (typeof loadSavedRunkeeperTweets !== 'function') {
	function loadSavedRunkeeperTweets() {
		return fetch('data/saved_tweets.json').then(function (resp) {
			if (!resp.ok) throw new Error('Failed to load saved_tweets.json');
			return resp.json();
		});
	}
}

//Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function (event) {
	addEventHandlerForSearch();
	loadSavedRunkeeperTweets().then(parseTweets).catch(function (err) {
		console.error(err);
		window.alert('Failed to load tweets: ' + err.message);
	});
});