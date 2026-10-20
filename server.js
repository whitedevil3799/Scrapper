import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { ANIME } from '@genga-movie/aniwatch';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// YEH SAHI CLASS HAI: HiAnime() hi aniwatchtv.to ko scrape karta hai
const hianime = new ANIME.HiAnime();

// 1. AniList se Search
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
        res.status(500).json({ error: 'Failed to search' });
    }
});

// 2. Video Link Scrape (HiAnime se, jo aniwatchtv.to hai)
app.get('/api/video', async (req, res) => {
    const { title, episode } = req.query;
    if (!title) return res.status(400).json({ error: 'Title required' });

    try {
        // Aniwatchtv.to par search
        const searchResult = await hianime.search(title);
        
        if (!searchResult || !searchResult.animes || searchResult.animes.length === 0) {
            return res.status(404).json({ error: 'Anime not found on Aniwatch' });
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
        res.status(500).json({ error: 'Video scrape failed. Aniwatch might be blocking.' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
