const express = require('express');
const multer = require('multer');
const pool = require('../config/database');
const authenticateToken = require('../middleware/auth');
const { uploadToS3, deleteFromS3 } = require('../services/fileService');

const router = express.Router();
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Get all projects for user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', pdf.id,
                               'name', pdf.name,
                               'level', pdf.level,
                               'fileUrl', pdf.file_url
                           )
                       ) FILTER (WHERE pdf.id IS NOT NULL), 
                       '[]'
                   ) as pdfs
            FROM projects p
            LEFT JOIN pdfs pdf ON p.id = pdf.project_id
            WHERE p.user_id = $1
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `, [req.user.userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Create new project
router.post('/', authenticateToken, upload.array('pdfs'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { name, data = '{}' } = req.body;
        
        // Create project
        const projectResult = await client.query(
            'INSERT INTO projects (user_id, name, data) VALUES ($1, $2, $3) RETURNING *',
            [req.user.userId, name, data]
        );

        const project = projectResult.rows[0];
        const pdfs = [];

        // Upload PDFs if provided
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const fileUrl = await uploadToS3(file);
                
                const pdfResult = await client.query(
                    'INSERT INTO pdfs (project_id, name, file_url, file_size) VALUES ($1, $2, $3, $4) RETURNING *',
                    [project.id, file.originalname, fileUrl, file.size]
                );
                
                pdfs.push(pdfResult.rows[0]);
            }
        }

        await client.query('COMMIT');

        res.status(201).json({ ...project, pdfs });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    } finally {
        client.release();
    }
});

// Update project
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, data } = req.body;

        const result = await pool.query(
            'UPDATE projects SET name = $1, data = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
            [name, JSON.stringify(data), id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { id } = req.params;

        // Get PDFs to delete from S3
        const pdfsResult = await client.query('SELECT file_url FROM pdfs WHERE project_id = $1', [id]);
        
        // Delete project (cascades to PDFs)
        const result = await client.query(
            'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Delete files from S3
        for (const pdf of pdfsResult.rows) {
            await deleteFromS3(pdf.file_url);
        }

        await client.query('COMMIT');
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    } finally {
        client.release();
    }
});

module.exports = router;