const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

// Discord and GPTs integration
const { DiscordNotifier, GPTsIntegration } = require('./discord-integration');
const discordNotifier = new DiscordNotifier();
const gptsIntegration = new GPTsIntegration();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.use(cors());
app.use(express.json());

// Database setup
const dbPath = './kpi_enhanced.db';

// Create new database
const db = new sqlite3.Database(dbPath);

// Initialize database tables with enhanced schema
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Enhanced KPI Goals table
  db.run(`CREATE TABLE IF NOT EXISTS kpi_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_start DATE NOT NULL,
    emails_manual_target INTEGER DEFAULT 0,
    emails_outsource_target INTEGER DEFAULT 0,
    valid_emails_manual_target INTEGER DEFAULT 0,
    valid_emails_outsource_target INTEGER DEFAULT 0,
    reply_target INTEGER DEFAULT 0,
    reply_rate_target REAL DEFAULT 0,
    meetings_target INTEGER DEFAULT 0,
    meeting_rate_target REAL DEFAULT 0,
    deals_target INTEGER DEFAULT 0,
    deal_rate_target REAL DEFAULT 0,
    projects_target INTEGER DEFAULT 0,
    project_rate_target REAL DEFAULT 0,
    ongoing_projects_target INTEGER DEFAULT 0,
    slide_views_target INTEGER DEFAULT 0,
    slide_view_rate_target REAL DEFAULT 0,
    video_views_target INTEGER DEFAULT 0,
    video_view_rate_target REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Enhanced Daily KPI entries
  db.run(`CREATE TABLE IF NOT EXISTS daily_kpi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    emails_sent_manual INTEGER DEFAULT 0,
    emails_sent_outsource INTEGER DEFAULT 0,
    valid_emails_manual INTEGER DEFAULT 0,
    valid_emails_outsource INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    meetings_scheduled INTEGER DEFAULT 0,
    deals_closed INTEGER DEFAULT 0,
    projects_created INTEGER DEFAULT 0,
    ongoing_projects INTEGER DEFAULT 0,
    slide_views INTEGER DEFAULT 0,
    video_views INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, date)
  )`);
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name],
      function(err) {
        if (err) {
          console.error('Registration error:', err);
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
          }
          return res.status(500).json({ error: '登録に失敗しました' });
        }
        
        const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET);
        res.json({ token, user: { id: this.lastID, email, name } });
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name } 
    });
  });
});

// Enhanced KPI Goals routes
app.post('/api/kpi-goals', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const goals = req.body;
  
  db.run(
    `INSERT INTO kpi_goals (
      user_id, week_start, 
      emails_manual_target, emails_outsource_target,
      valid_emails_manual_target, valid_emails_outsource_target,
      reply_target, reply_rate_target,
      meetings_target, meeting_rate_target,
      deals_target, deal_rate_target,
      projects_target, project_rate_target,
      ongoing_projects_target,
      slide_views_target, slide_view_rate_target,
      video_views_target, video_view_rate_target
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, goals.week_start,
      goals.emails_manual_target || 0, goals.emails_outsource_target || 0,
      goals.valid_emails_manual_target || 0, goals.valid_emails_outsource_target || 0,
      goals.reply_target || 0, goals.reply_rate_target || 0,
      goals.meetings_target || 0, goals.meeting_rate_target || 0,
      goals.deals_target || 0, goals.deal_rate_target || 0,
      goals.projects_target || 0, goals.project_rate_target || 0,
      goals.ongoing_projects_target || 0,
      goals.slide_views_target || 0, goals.slide_view_rate_target || 0,
      goals.video_views_target || 0, goals.video_view_rate_target || 0
    ],
    function(err) {
      if (err) {
        console.error('Goals save error:', err);
        return res.status(500).json({ error: 'Failed to save goals' });
      }
      res.json({ id: this.lastID, message: 'Goals saved successfully' });
    }
  );
});

app.get('/api/kpi-goals/current', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  db.get(
    `SELECT * FROM kpi_goals 
     WHERE user_id = ? 
     ORDER BY week_start DESC 
     LIMIT 1`,
    [userId],
    (err, row) => {
      if (err) {
        console.error('Goals fetch error:', err);
        return res.status(500).json({ error: 'Failed to fetch goals' });
      }
      res.json(row || {});
    }
  );
});

// Enhanced Daily KPI routes
app.post('/api/daily-kpi', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const kpi = req.body;
  
  db.run(
    `INSERT OR REPLACE INTO daily_kpi (
      user_id, date,
      emails_sent_manual, emails_sent_outsource,
      valid_emails_manual, valid_emails_outsource,
      replies_received, meetings_scheduled, deals_closed,
      projects_created, ongoing_projects,
      slide_views, video_views, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, kpi.date,
      kpi.emails_sent_manual || 0, kpi.emails_sent_outsource || 0,
      kpi.valid_emails_manual || 0, kpi.valid_emails_outsource || 0,
      kpi.replies_received || 0, kpi.meetings_scheduled || 0, kpi.deals_closed || 0,
      kpi.projects_created || 0, kpi.ongoing_projects || 0,
      kpi.slide_views || 0, kpi.video_views || 0, kpi.notes || ''
    ],
    function(err) {
      if (err) {
        console.error('Daily KPI save error:', err);
        return res.status(500).json({ error: 'Failed to save daily KPI' });
      }
      // Discord通知を送信
      discordNotifier.sendDailyKPINotification(userId, kpi);
      
      res.json({ message: 'Daily KPI saved successfully' });
    }
  );
});

app.get('/api/daily-kpi/:date', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { date } = req.params;
  
  db.get(
    'SELECT * FROM daily_kpi WHERE user_id = ? AND date = ?',
    [userId, date],
    (err, row) => {
      if (err) {
        console.error('Daily KPI fetch error:', err);
        return res.status(500).json({ error: 'Failed to fetch daily KPI' });
      }
      res.json(row || {});
    }
  );
});

// Enhanced Weekly summary
app.get('/api/weekly-summary/:weekStart', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { weekStart } = req.params;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  db.all(
    `SELECT * FROM daily_kpi 
     WHERE user_id = ? AND date >= ? AND date <= ?
     ORDER BY date`,
    [userId, weekStart, weekEnd.toISOString().split('T')[0]],
    (err, rows) => {
      if (err) {
        console.error('Weekly summary error:', err);
        return res.status(500).json({ error: 'Failed to fetch weekly data' });
      }
      
      // Calculate enhanced totals
      const summary = {
        daily_data: rows,
        totals: {
          emails_sent_manual: rows.reduce((sum, row) => sum + (row.emails_sent_manual || 0), 0),
          emails_sent_outsource: rows.reduce((sum, row) => sum + (row.emails_sent_outsource || 0), 0),
          valid_emails_manual: rows.reduce((sum, row) => sum + (row.valid_emails_manual || 0), 0),
          valid_emails_outsource: rows.reduce((sum, row) => sum + (row.valid_emails_outsource || 0), 0),
          replies_received: rows.reduce((sum, row) => sum + (row.replies_received || 0), 0),
          meetings_scheduled: rows.reduce((sum, row) => sum + (row.meetings_scheduled || 0), 0),
          deals_closed: rows.reduce((sum, row) => sum + (row.deals_closed || 0), 0),
          projects_created: rows.reduce((sum, row) => sum + (row.projects_created || 0), 0),
          ongoing_projects: rows.length > 0 ? rows[rows.length - 1].ongoing_projects || 0 : 0,
          slide_views: rows.reduce((sum, row) => sum + (row.slide_views || 0), 0),
          video_views: rows.reduce((sum, row) => sum + (row.video_views || 0), 0)
        }
      };
      
      // Calculate rates
      const totalValidEmails = summary.totals.valid_emails_manual + summary.totals.valid_emails_outsource;
      summary.reply_rate = totalValidEmails > 0 
        ? (summary.totals.replies_received / totalValidEmails * 100).toFixed(2)
        : 0;
      summary.meeting_rate = summary.totals.replies_received > 0
        ? (summary.totals.meetings_scheduled / summary.totals.replies_received * 100).toFixed(2)
        : 0;
      summary.deal_rate = summary.totals.meetings_scheduled > 0
        ? (summary.totals.deals_closed / summary.totals.meetings_scheduled * 100).toFixed(2)
        : 0;
      summary.project_rate = summary.totals.meetings_scheduled > 0
        ? (summary.totals.projects_created / summary.totals.meetings_scheduled * 100).toFixed(2)
        : 0;
      summary.slide_view_rate = totalValidEmails > 0
        ? (summary.totals.slide_views / totalValidEmails * 100).toFixed(2)
        : 0;
      summary.video_view_rate = totalValidEmails > 0
        ? (summary.totals.video_views / totalValidEmails * 100).toFixed(2)
        : 0;
      
      res.json(summary);
    }
  );
});

// Discord notification function
const sendDiscordNotification = async (message) => {
  if (!DISCORD_WEBHOOK_URL) return;
  
  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      content: message
    });
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
};

// Daily reminder at 6 PM
cron.schedule('0 18 * * *', () => {
  sendDiscordNotification('📊 今日の営業KPIを入力してください！\nhttps://your-app-url.com/daily-input');
});

// Weekly summary on Friday at 5 PM
cron.schedule('0 17 * * 5', () => {
  sendDiscordNotification('📈 週次レビューの時間です！今週の振り返りを行いましょう。\nhttps://your-app-url.com/weekly-review');
});

// GPTs Analysis endpoint
app.post('/api/gpts/analyze-weekly', authenticateToken, async (req, res) => {
  const { weeklyData, goals } = req.body;
  
  try {
    const analysis = await gptsIntegration.analyzeWeeklyPerformance(weeklyData, goals);
    res.json(analysis);
  } catch (error) {
    console.error('GPT analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// GPTs Email improvement endpoint
app.post('/api/gpts/improve-email', authenticateToken, async (req, res) => {
  const { template, replyRate } = req.body;
  
  try {
    const suggestions = await gptsIntegration.suggestEmailImprovement(template, replyRate);
    res.json(suggestions);
  } catch (error) {
    console.error('GPT suggestion error:', error);
    res.status(500).json({ error: 'Suggestion failed' });
  }
});

// Discord test notification endpoint
app.post('/api/discord/test', authenticateToken, async (req, res) => {
  const { message } = req.body;
  
  if (!DISCORD_WEBHOOK_URL) {
    return res.status(400).json({ error: 'Discord webhook not configured' });
  }
  
  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      content: message || 'テスト通知: KPIトラッカーから送信'
    });
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Discord test failed:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 拡張APIルートを設定
const { setupExtendedRoutes } = require('./api-extensions');
setupExtendedRoutes(app, db, authenticateToken);

// 週次レビューテーブルを作成
db.run(`CREATE TABLE IF NOT EXISTS weekly_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  achievements TEXT,
  challenges TEXT,
  improvements TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
)`);

app.listen(PORT, () => {
  console.log(`Enhanced KPI Server running on port ${PORT}`);
});