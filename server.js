const express = require('express');
const cors = require('cors');
const { extractVixSrc } = require('./extractors/vxr');
//const { extractVidrock } = require('./extractors/vidrock');
//const { extractVidSrc } = require('./extractors/vidsrc');
//const { extractVideasy } = require('./extractors/videasy');
//const { extractVidzee } = require('./extractors/vidzee');
//const { extractPrimeSrc } = require('./extractors/primesrc');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Available extractors
const extractors = {
    vixsrc: extractVixSrc
    //vidrock: extractVidrock,
    //vidsrc: extractVidSrc,
    //videasy: extractVideasy,
    //vidzee: extractVidzee,
    //primesrc: extractPrimeSrc
};

// Utility function to extract from multiple servers
async function extractFromServers(params, serverNames) {
    const results = [];

    for (const serverName of serverNames) {
        if (extractors[serverName]) {
            const result = await extractors[serverName](params);
            results.push(result);
        }
    }

    return results;
}

// Movie endpoint
app.get('/movie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { server = 'all' } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Missing id parameter' });
        }

        const params = { id, type: 'movie' };
        let serverNames = [];

        if (server === 'all') {
            serverNames = Object.keys(extractors);
        } else if (extractors[server]) {
            serverNames = [server];
        } else {
            return res.status(400).json({
                error: `Invalid server: ${server}. Available: ${Object.keys(extractors).join(', ')}, all`
            });
        }

        const results = await extractFromServers(params, serverNames);

        // Build response with all servers
        const response = {
            type: 'movie',
            id,
            query: { server }
        };

        // Add each server's result
        results.forEach(result => {
            response[result.server] = {
                streams: result.streams,
                ...(result.error && { error: result.error })
            };
        });

        // Count servers with positive responses
        const serversWithStreams = results.filter(r => r.streams.length > 0).length;
        response.totalServersWithStreams = serversWithStreams;
        response.totalStreamsFound = results.reduce((acc, r) => acc + r.streams.length, 0);

        return res.json(response);

    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// TV show endpoint
app.get('/tv/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode, server = 'all' } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Missing id parameter' });
        }

        if (!season || !episode) {
            return res.status(400).json({ error: 'Missing season or episode parameters' });
        }

        const params = { id, type: 'tv', season, episode };
        let serverNames = [];

        if (server === 'all') {
            serverNames = Object.keys(extractors);
        } else if (extractors[server]) {
            serverNames = [server];
        } else {
            return res.status(400).json({
                error: `Invalid server: ${server}. Available: ${Object.keys(extractors).join(', ')}, all`
            });
        }

        const results = await extractFromServers(params, serverNames);

        // Build response with all servers
        const response = {
            type: 'tv',
            id,
            season,
            episode,
            query: { server }
        };

        // Add each server's result
        results.forEach(result => {
            response[result.server] = {
                streams: result.streams,
                ...(result.error && { error: result.error })
            };
        });

        // Count servers with positive responses
        const serversWithStreams = results.filter(r => r.streams.length > 0).length;
        response.totalServersWithStreams = serversWithStreams;
        response.totalStreamsFound = results.reduce((acc, r) => acc + r.streams.length, 0);

        return res.json(response);

    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Root endpoint - Documentation
app.get('/', (req, res) => {
    const baseUrl = req.get('host');
    const protocol = req.protocol;
    const fullUrl = `${protocol}://${baseUrl}`;

    res.json({
        title: '🎬 Video Extractor API',
        description: 'Extract streams from multiple video hosting services',
        version: '1.0.0',
        baseUrl: fullUrl,
        status: 'active',
        availableServers: Object.keys(extractors),

        endpoints: {
            movies: {
                path: '/movie/:id',
                method: 'GET',
                description: 'Extract movie streams from one or multiple servers',
                parameters: {
                    id: {
                        type: 'string|number',
                        required: true,
                        description: 'The movie ID or IMDB ID'
                    },
                    server: {
                        type: 'string',
                        required: false,
                        default: 'all',
                        description: 'Specific server or "all" for all servers',
                        allowedValues: [...Object.keys(extractors), 'all']
                    }
                },
                examples: [
                    {
                        description: 'Get movie streams from all servers',
                        url: `${fullUrl}/movie/550`,
                        curl: `curl "${fullUrl}/movie/550"`
                    },
                    {
                        description: 'Get movie from specific server (VidRock)',
                        url: `${fullUrl}/movie/550?server=vidrock`,
                        curl: `curl "${fullUrl}/movie/550?server=vidrock"`
                    },
                    {
                        description: 'Get movie from VixSrc',
                        url: `${fullUrl}/movie/550?server=vixsrc`,
                        curl: `curl "${fullUrl}/movie/550?server=vixsrc"`
                    }
                ],
                responseExample: {
                    type: 'movie',
                    id: '550',
                    query: { server: 'all' },
                    vixsrc: { streams: [] },
                    vidrock: { streams: [] },
                    vidsrc: { streams: [] },
                    videasy: { streams: [] },
                    vidzee: { streams: [] },
                    primesrc: { streams: [] },
                    totalServersWithStreams: 3,
                    totalStreamsFound: 8
                }
            },

            tvshows: {
                path: '/tv/:id',
                method: 'GET',
                description: 'Extract TV show streams from one or multiple servers',
                parameters: {
                    id: {
                        type: 'string|number',
                        required: true,
                        description: 'The TV show ID or TMDB ID'
                    },
                    season: {
                        type: 'number',
                        required: true,
                        description: 'Season number'
                    },
                    episode: {
                        type: 'number',
                        required: true,
                        description: 'Episode number'
                    },
                    server: {
                        type: 'string',
                        required: false,
                        default: 'all',
                        description: 'Specific server or "all" for all servers',
                        allowedValues: [...Object.keys(extractors), 'all']
                    }
                },
                examples: [
                    {
                        description: 'Get TV show streams from all servers',
                        url: `${fullUrl}/tv/1399?season=1&episode=1`,
                        curl: `curl "${fullUrl}/tv/1399?season=1&episode=1"`
                    },
                    {
                        description: 'Get TV show from specific server',
                        url: `${fullUrl}/tv/1399?season=1&episode=5&server=vidrock`,
                        curl: `curl "${fullUrl}/tv/1399?season=1&episode=5&server=vidrock"`
                    },
                    {
                        description: 'Get specific episode from VixSrc',
                        url: `${fullUrl}/tv/1399?season=2&episode=3&server=vixsrc`,
                        curl: `curl "${fullUrl}/tv/1399?season=2&episode=3&server=vixsrc"`
                    }
                ],
                responseExample: {
                    type: 'tv',
                    id: '1399',
                    season: '1',
                    episode: '1',
                    query: { server: 'all' },
                    vixsrc: { streams: [] },
                    vidrock: { streams: [] },
                    vidsrc: { streams: [] },
                    videasy: { streams: [] },
                    vidzee: { streams: [] },
                    primesrc: { streams: [] },
                    totalServersWithStreams: 4,
                    totalStreamsFound: 12
                }
            },

            health: {
                path: '/health',
                method: 'GET',
                description: 'Health check endpoint',
                examples: [
                    {
                        url: `${fullUrl}/health`,
                        curl: `curl "${fullUrl}/health"`
                    }
                ]
            }
        },

        servers: {
            vixsrc: {
                name: 'VixSrc',
                description: 'Video extraction from VixSrc servers'
            },
            vidrock: {
                name: 'VidRock',
                description: 'Video extraction from VidRock servers'
            },
            vidsrc: {
                name: 'VidSrc',
                description: 'Video extraction from VidSrc servers'
            },
            videasy: {
                name: 'Videasy',
                description: 'Video extraction from Videasy servers'
            },
            vidzee: {
                name: 'VidZee',
                description: 'Video extraction from VidZee servers'
            },
            primesrc: {
                name: 'PrimeSrc',
                description: 'Video extraction from PrimeSrc servers'
            }
        },

        quickStart: [
            `1. Get all available streams for a movie: GET ${fullUrl}/movie/550`,
            `2. Get streams from specific server: GET ${fullUrl}/movie/550?server=vidrock`,
            `3. Get TV show episode: GET ${fullUrl}/tv/1399?season=1&episode=1`,
            `4. Combine parameters: GET ${fullUrl}/tv/1399?season=2&episode=5&server=vixsrc`
        ],

        notes: {
            performance: 'Requesting from "all" servers may take longer but returns results from all available sources',
            errors: 'Some servers may fail to extract if the content is unavailable or server is down',
            streams: 'Each successful extraction returns an array of streams with URLs and metadata',
            cors: 'CORS is enabled - can be called from browser/frontend applications'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        availableServers: Object.keys(extractors),
        endpoints: {
            movie: '/movie/:id?server=all|vxr|vidrock|vidsrc|videasy|vidzee|primesrc',
            tv: '/tv/:id?season=1&episode=1&server=all|vxr|vidrock|vidsrc|videasy|vidzee|primesrc',
            health: '/health',
            root: '/'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'Visit root endpoint for full documentation',
        availableEndpoints: {
            'GET /': 'Full API documentation with examples',
            'GET /movie/:id': 'Get movie streams (query: ?server=all|vxr|vidrock|vidsrc|videasy|vidzee|primesrc)',
            'GET /tv/:id': 'Get TV show streams (query: ?season=X&episode=Y&server=all|vxr|vidrock|vidsrc|videasy|vidzee|primesrc)',
            'GET /health': 'Health check'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✓ Extractor server running on http://localhost:${PORT}`);
    console.log(`✓ Available servers: ${Object.keys(extractors).join(', ')}`);
    console.log(`\nExample requests:`);
    console.log(`  GET http://localhost:${PORT}/movie/12345`);
    console.log(`  GET http://localhost:${PORT}/movie/12345?server=vxr`);
    console.log(`  GET http://localhost:${PORT}/tv/12345?season=1&episode=1`);
    console.log(`  GET http://localhost:${PORT}/tv/12345?season=1&episode=1&server=vidrock`);
});
