class Tweet {
	private text:string;
	time:Date;

	constructor(tweet_text:string, tweet_time:string) {
        this.text = tweet_text;
		this.time = new Date(tweet_time);//, "ddd MMM D HH:mm:ss Z YYYY"
	}

	//returns either 'live_event', 'achievement', 'completed_event', or 'miscellaneous'
    get source():string {
        const t = this.text;
        // Live events (streaming/right now)
        if (/right now/i.test(t) && /live/i.test(t) || /#RKLive/i.test(t)) {
            return 'live_event';
        }
        // Achievements/goals
        if (/^Achieved a new personal record/i.test(t) || /^I just set a goal/i.test(t) || /#FitnessAlerts/i.test(t)) {
            return 'achievement';
        }
        // Completed events (posted/completed)
        if (/^Just\s+(completed|posted)\s+a\s+/i.test(t)) {
            return 'completed_event';
        }
        return 'miscellaneous';
    }

    //returns a boolean, whether the text includes any content written by the person tweeting.
    get written():boolean {
        if (this.source !== 'completed_event') return false;

        // Remove URL and #Runkeeper to analyze remaining content
        const withoutUrl = this.text.replace(/https?:\/\/\S+/gi, '').replace(/#Runkeeper/gi, '').trim();

        // Look for a hyphen-separated user note: " - <note>"
        const dashIdx = withoutUrl.indexOf(' - ');
        if (dashIdx === -1) return false;

        const note = withoutUrl.substring(dashIdx + 3).trim();
        if (!note) return false;

        // Treat some common auto-generated phrases as NOT user-written
        const autoPhrases = [
            /^TomTom MySports Watch\b/i,
            /^MySports Freestyle\b/i,
            /^Charge Running app/i,
            /^HITT class$/i,
            /^#\w+(\s+#\w+)*$/i
        ];
        if (autoPhrases.some((p) => p.test(note))) return false;

        // Otherwise assume it's user-written
        return true;
    }

    get writtenText():string {
        if(!this.written) {
            return "";
        }
        // Extract the portion after " - " and before URL/hashtags
        let s = this.text;
        // Cut at first URL
        s = s.replace(/https?:\/\/\S+/gi, '');
        // Remove trailing #Runkeeper and other whitespace
        s = s.replace(/#Runkeeper/gi, '').trim();
        const dashIdx = s.indexOf(' - ');
        if (dashIdx >= 0) {
            const note = s.substring(dashIdx + 3).trim();
            return note;
        }
        return '';
    }

    get activityType():string {
        if (this.source != 'completed_event') {
            return "unknown";
        }
        const t = this.text;
        // Try to extract activity after a numeric distance + unit
        // e.g., "Just completed a 4.87 km run with @Runkeeper."
        const m = t.match(/Just\s+(?:completed|posted)\s+a\s+(?:\d+(?:\.\d+)?)\s*(?:km|mi)\s+([^\-\n#]+?)(?:\s+with|\s+-|\s+in|\.|$)/i);
        let activity = '';
        if (m && m[1]) {
            activity = m[1].trim();
        } else {
            // Fallback: pattern without distance, e.g., "Just posted a yoga in 30:00"
            const m2 = t.match(/Just\s+(?:completed|posted)\s+a\s+([A-Za-z ]+?)\s+in\s+\d/i);
            if (m2 && m2[1]) {
                activity = m2[1].trim();
            }
        }
        if (!activity) return 'unknown';
        activity = activity.toLowerCase();
        // Normalize common variants
        activity = activity
            .replace(/mtn bike|mountain bike/i, 'bike')
            .replace(/biking/i, 'bike')
            .replace(/ski run/i, 'ski')
            .replace(/elliptical workout/i, 'elliptical')
            .replace(/spinning workout/i, 'spinning')
            .replace(/strength workout/i, 'strength')
            .replace(/circuit workout/i, 'circuit')
            .replace(/group workout/i, 'group workout')
            .replace(/my?sports freestyle/i, 'freestyle')
            .trim();
        // Only keep the first one or two tokens if very long
        const tokens = activity.split(/\s+/);
        if (tokens.length > 2) {
            activity = tokens.slice(0, 2).join(' ');
        }
        return activity;
    }

    get distance():number {
        if(this.source != 'completed_event') {
            return 0;
        }
        const t = this.text;
        const m = t.match(/(\d+(?:\.\d+)?)\s*(km|mi)\b/i);
        if (!m) return 0;
        const val = parseFloat(m[1]);
        if (!isFinite(val)) return 0;
        const unit = m[2].toLowerCase();
        const miles = unit === 'km' ? val / 1.609 : val;
        return miles;
    }

    getHTMLTableRow(rowNumber:number):string {
        // Build a table row with: index, activity type, tweet text with clickable links
        const activity = this.activityType || 'unknown';
        // Convert URLs in the original text to clickable anchors (open in new tab)
        const linkified = this.text.replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1<\/a>');
        const safeText = linkified; // Simple trust as text data comes from provided dataset
        return `<tr><th scope="row">${rowNumber}</th><td>${activity}</td><td>${safeText}</td></tr>`;
    }
}