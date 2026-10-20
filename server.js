const express = require('express');
const cors = require('cors');
const { HiAnime } = require('aniwatch'); // Naya package

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const scraper = new HiAnime.Scraper();

// Route: Search for anime
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        // Yeh package automatically search karke data le aayega
        const data = await scraper.search(query);
        
        // Frontend ko wahi format mein bhej rahe hain jo usne expect kiya tha
        const results = data.animes.map(anime => ({
            title: anime.name,
            link: anime.id, // Episode ID
            image: anime.poster
        }));

        res.json(results);
    } catch (error) {
        console.error('Search Error:', error.message);
        res.status(500).json({ error: 'Failed to search anime' });
    }
});

// Route: Get streaming source (Abhi ke liye placeholder)
app.get('/api/stream', async (req, res) => {
    const episodeId = req.query.url;
    if (!episodeId) return res.status(400).json({ error: 'ID required' });

    try {
        // Yeh package episode ke servers aur links nikaal sakta hai
        const data = await scraper.getEpisodeSources(episodeId);
        
        // Agar direct link mil jaye toh frontend ko bhej do
        if (data && data.sources && data.sources.length > 0) {
            res.json({ source: data.sources[0].url, type: data.sources[0].isM3U8 ? 'application/x-mpegURL' : 'video/mp4' });
        } else {
            res.status(404).json({ error: 'No stream source found' });
        }
    } catch (error) {
        console.error('Stream Error:', error.message);
        res.status(500).json({ error: 'Failed to get stream source' });
    }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
