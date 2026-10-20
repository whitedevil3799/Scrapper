require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SCRAPER_API_KEY;

// Helper function to build the ScraperAPI URL
const buildScraperUrl = (url) => `http://api.scraperapi.com?api_key=${API_KEY}&url=${encodeURIComponent(url)}`;

// Route: Search for anime
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        // NOTE: You will need to inspect the target site to get the exact URL and CSS selectors
        const targetUrl = `https://hianimes.se/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(buildScraperUrl(targetUrl));
        const $ = cheerio.load(response.data);

        const results = [];
        // Placeholder selectors - you MUST change these based on the actual site's HTML
        $('.anime-card').each((i, el) => {
            const title = $(el).find('.title').text().trim(); 
            const link = $(el).find('a').attr('href'); 
            const image = $(el).find('img').attr('src'); 
            if (title && link) {
                results.push({ title, link, image });
            }
        });

        res.json(results);
    } catch (error) {
        console.error('Search Error:', error.message);
        res.status(500).json({ error: 'Failed to scrape search results' });
    }
});

// Route: Get streaming source for an episode
app.get('/api/stream', async (req, res) => {
    const episodeUrl = req.query.url;
    if (!episodeUrl) return res.status(400).json({ error: 'URL required' });

    try {
        const response = await axios.get(buildScraperUrl(episodeUrl));
        const $ = cheerio.load(response.data);
        
        // Placeholder selector - you MUST change this based on the actual site
        const videoSource = $('video source').attr('src') || $('video').attr('src');

        if (videoSource) {
            res.json({ source: videoSource, type: 'video/mp4' });
        } else {
            res.status(404).json({ error: 'No stream source found' });
        }
    } catch (error) {
        console.error('Stream Error:', error.message);
        res.status(500).json({ error: 'Failed to scrape stream source' });
    }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

