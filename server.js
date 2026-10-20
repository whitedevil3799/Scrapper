import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// Helper function for ScraperAPI
const getScrapedUrl = (url) => `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&render=true`;

// 1. AniList se Search (Data ke liye - Yeh perfect chal raha hai)
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

// 2. Anikoto se Video Link Scrape (ScraperAPI ke through)
app.get('/api/video', async (req, res) => {
    const { title, episode } = req.query;
    if (!title) return res.status(400).json({ error: 'Title required' });

    try {
        // Step 1: Anikoto par search karo
        const searchUrl = `https://anikoto.site/search?keyword=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(getScrapedUrl(searchUrl));
        const $ = cheerio.load(searchRes.data);
        
        // Search results se pehla anime link nikaalo (selectors Anikoto ke hisaab se)
        let animeLink = $('.anime-list a').first().attr('href') || $('.item a').first().attr('href');
        
        if (!animeLink) {
            return res.status(404).json({ error: 'Anime not found on Anikoto' });
        }

        // Step 2: Episode page par jao
        // Note: URL structure Anikoto par change ho sakta hai, usually it's /watch/anime-name-episode-1
        const epNum = episode || 1;
        // Agar search result mein direct episode link nahi hai, toh hum episode link construct karte hain
        const episodeUrl = `${animeLink}-episode-${epNum}`; 
        
        const epRes = await axios.get(getScrapedUrl(episodeUrl));
        const ep$ = cheerio.load(epRes.data);

        // Step 3: Video source dhoondho
        // Anikoto video ko iframe mein load karta hai, isliye humें iframe ka src nikaalna hoga
        let iframeSrc = ep$('iframe').attr('src');
        
        // Agar direct .m3u8 nahi mila, toh iframe ke andar se nikaalne ki koshish karo
        if (iframeSrc) {
            // Yahan hum assume kar rahe hain ki iframe ka link direct video player hai
            // Asli servers (Megaplay) se .m3u8 nikaalne ke liye complex logic lagta hai
            res.json({ 
                source: iframeSrc, 
                type: 'iframe', // Frontend ko batayenge ki iframe load karna hai
                message: 'Video iframe found. Play in iframe.'
            });
        } else {
            res.status(404).json({ error: 'Video iframe nahi mila.' });
        }

    } catch (error) {
        console.error('Video Scrape Error:', error.message);
        res.status(500).json({ error: 'Video scrape failed via ScraperAPI.' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
