const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Adjust path as needed
const { authenticateShopOwner } = require('./middleware'); // path as needed

// GET all todos for a specific store
router.get('/:storeId',authenticateShopOwner, async (req, res) => {

  const { storeId } = req.params;
//   console.log('📥 Getting todos for store:', storeId); // ADD THIS LINE

  try {
    const [rows] = await pool.query(
      'SELECT * FROM todos WHERE store_id = ? ORDER BY created_at DESC',
      [storeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching todos:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST a new todo
router.post('/',authenticateShopOwner, async (req, res) => {
  const { store_id, task_text } = req.body;

  if (!store_id || !task_text) {
    return res.status(400).json({ error: 'Store ID and task text are required' });
  }

  try {
    await pool.query(
      'INSERT INTO todos (store_id, task_text) VALUES (?, ?)',
      [store_id, task_text]
    );
    res.status(201).json({ message: '✅ Task added successfully' });
  } catch (err) {
    console.error('Error adding task:', err);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

// PUT update a todo
router.put('/:taskId',authenticateShopOwner, async (req, res) => {
  const { taskId } = req.params;
  const { task_text } = req.body;

  if (!task_text) {
    return res.status(400).json({ error: 'Task text is required' });
  }

  try {
    await pool.query(
      'UPDATE todos SET task_text = ? WHERE task_id = ?',
      [task_text, taskId]
    );
    res.json({ message: '✏️ Task updated successfully' });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE a todo
router.delete('/:taskId',authenticateShopOwner, async (req, res) => {
  const { taskId } = req.params;

  try {
    await pool.query(
      'DELETE FROM todos WHERE task_id = ?',
      [taskId]
    );
    res.json({ message: '🗑️ Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
