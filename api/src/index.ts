import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import { IDL } from './types/clawswap';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Solana setup
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

const programId = new PublicKey(process.env.PROGRAM_ID || 'FKTdYU5qqErJWkB1k2atg9v8JzwsYNveD2W1jAgoYNAW');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    network: process.env.SOLANA_RPC_URL || 'devnet'
  });
});

// Get all needs
app.get('/api/needs', async (req, res) => {
  try {
    // TODO: Implement need fetching via getProgramAccounts
    // For now, return mock data
    res.json({
      success: true,
      data: [],
      message: 'Needs fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching needs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch needs' 
    });
  }
});

// Get specific need
app.get('/api/needs/:id', async (req, res) => {
  try {
    const needId = parseInt(req.params.id);
    // TODO: Implement single need fetching
    res.json({
      success: true,
      data: null,
      message: 'Need not found'
    });
  } catch (error) {
    console.error('Error fetching need:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch need' 
    });
  }
});

// Get offers for a need
app.get('/api/needs/:id/offers', async (req, res) => {
  try {
    const needId = parseInt(req.params.id);
    // TODO: Implement offers fetching
    res.json({
      success: true,
      data: [],
      message: 'Offers fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch offers' 
    });
  }
});

// Get deals for a user
app.get('/api/deals/:publicKey', async (req, res) => {
  try {
    const userPubkey = req.params.publicKey;
    // TODO: Implement deals fetching
    res.json({
      success: true,
      data: [],
      message: 'Deals fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch deals' 
    });
  }
});

// Submit transaction (generic endpoint for signed transactions)
app.post('/api/submit-transaction', async (req, res) => {
  try {
    const { transaction, commitment } = req.body;
    
    if (!transaction) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transaction is required' 
      });
    }

    // TODO: Submit transaction to Solana
    res.json({
      success: true,
      signature: 'mock-signature',
      message: 'Transaction submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting transaction:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit transaction' 
    });
  }
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ClawSwap API running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Network: ${process.env.SOLANA_RPC_URL || 'devnet'}`);
});