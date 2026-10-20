const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 1. AniList se search (Information ke liye)
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        const graphqlQuery = {
            query: `
            query ($search: String) {
              Page(page: 1, perPage: 10) {
                media(search: $search, type: ANIME) {
                  id
                  title { romaji english }
                  coverImage { large }
                  description
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
            image: anime.coverImage.large,
            description: anime.description,
            totalEpisodes: anime.episodes
        }));

        res.json(results);
    } catch (error) {
        console.error('AniList Search Error:', error.message);
        res.status(500).json({ error: 'Failed to search from AniList' });
    }
});

// 2. hianimes.se se video link nikaalna (Proxy ke through)
app.get('/api/video', async (req, res) => {
    const { title, episode } = req.query;
    if (!title) return res.status(400).json({ error: 'Title required' });

    try {
        // Step 1: hianimes.se par search karo (ya direct URL banao)
        // Yahan hum maan rahe hain ki aapke paas search ka URL structure hai
        // Aapko is URL ko update karna padega agar site ka search structure alag hai
        const searchUrl = `https://hianimes.se/search?q=${encodeURIComponent(title)}`;
        
        // Note: hianimes.se Cloudflare use kar sakta hai, isliye axios fail ho sakta hai
        // Agar fail ho, toh aapko ScraperAPI ya similar service use karni padegi
        
        const searchResponse = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(searchResponse.data);
        
        // Search results se pehla anime link nikaalo (selectors change karne pad sakte hain)
        let animeLink = $('.anime-card a').first().attr('href');
        
        if (!animeLink) {
            return res.status(404).json({ error: 'Anime not found on hianimes.se' });
        }

        // Step 2: Episode page par jao
        const episodeUrl = `https://hianimes.se${animeLink}-episode-${episode || 1}`;
        
        const episodeResponse = await axios.get(episodeUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const ep$ = cheerio.load(episodeResponse.data);
        
        // Video source nikaalne ki koshish karo
        // Yeh selectors change karne pad sakte hain, kyunki site JavaScript use karti hai
        let videoSource = ep$('video source').attr('src') || ep$('video').attr('src');
        
        // Agar direct video tag nahi mila, toh script tags mein dekho
        if (!videoSource) {
            const scripts = ep$('script').map((i, el) => ep$(el).html()).get();
            for (const script of scripts) {
                // .m3u8 link dhoondho
                const m3u8Match = script.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
                if (m3u8Match) {
                    videoSource = m3u8Match[0];
                    break;
                }
            }
        }
        
        if (videoSource) {
            res.json({ source: videoSource, isM3U8: videoSource.includes('.m3u8') });
        } else {
            res.status(404).json({ error: 'No video source found. Website may use JS rendering.' });
        }
    } catch (error) {
        console.error('Video Fetch Error:', error.message);
        res.status(500).json({ error: 'Failed to get video source. Site may block scraping.' });
    }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
