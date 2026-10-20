const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Package ko require se import karo
const { ANIME } = require('@genga-movie/aniwatch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 'HiAnime' (capital A) ka istemal karo, 'Hianime' nahi
const hianime = new ANIME.HiAnime();

// 1. AniList se Search (Information ke liye)
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        const graphqlQuery = {
            query: `
            query ($search: String) {
              Page(page: 1, perPage: 12) {
                media(search: $search, type: ANIME) {
                  id
                  title { romaji english }
                  coverImage { large }
                  episodes
                }
              }
            }`,
            variables: { search: query }
        };

        const response = await axios.post('https://graphql.anilist.co', graphqlQuery);
        const animes = response.data.data.Page.media;

        const results = animes.map(anime => ({
            id: anime.id,
            title: anime.title.romaji || anime.title.english,
            image: anime.coverImage.large
        }));

        res.json(results);
    } catch (error) {
        console.error("AniList Error:", error.message);
        res.status(500).json({ error: 'Failed to search' });
    }
});

// 2. Video Link Scrape karna
app.get('/api/video', async (req, res) => {
    const { title, episode } = req.query;
    if (!title) return res.status(400).json({ error: 'Title required' });

    try {
        const searchResult = await hianime.search(title);
        
        if (!searchResult || !searchResult.animes || searchResult.animes.length === 0) {
            return res.status(404).json({ error: 'Anime not found on streaming site' });
        }

        const animeId = searchResult.animes[0].id;
        const epNum = episode || 1;

        const episodes = await hianime.getEpisodes(animeId);
        
        if (!episodes || !episodes.episodes || episodes.episodes.length === 0) {
             return res.status(404).json({ error: 'Episodes not found' });
        }

        const targetEp = episodes.episodes.find(e => e.number == epNum) || episodes.episodes[0];

        const sources = await hianime.getEpisodeSources(targetEp.id, 'hd-1', 'sub');
        
        if (sources && sources.sources && sources.sources.length > 0) {
            res.json({ 
                source: sources.sources[0].url, 
                type: 'hls' 
            });
        } else {
            res.status(404).json({ error: 'Video link nahi mila' });
        }
    } catch (error) {
        console.error('Video Scrape Error:', error.message);
        res.status(500).json({ error: 'Video scrape failed. Server issue.' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
