# Database Triggers - Quick Usage Guide

## Overview

Database triggers are now automatically maintaining counter fields. You don't need to manually update counters in your application code!

## What's Automated

### ✅ Post Comment Counts
- **Field:** `posts.comment_count`
- **Auto-updated when:**
  - Comments are inserted
  - Comments are deleted
  - Comments are soft-deleted/restored

```javascript
// ✅ CORRECT - Counter updates automatically
await prisma.comment.create({
  data: {
    postId: post.id,
    userId: user.id,
    content: 'Great post!'
  }
});
// posts.comment_count is automatically incremented!

// ❌ WRONG - Don't do this anymore
await prisma.post.update({
  where: { id: post.id },
  data: { commentCount: { increment: 1 } }  // ← Remove this!
});
```

### ✅ Post Reaction Counts
- **Field:** `posts.reaction_count`
- **Auto-updated when:**
  - Reactions are inserted
  - Reactions are deleted

```javascript
// ✅ CORRECT - Counter updates automatically
await prisma.reaction.create({
  data: {
    postId: post.id,
    userId: user.id,
    type: 'AMEN'
  }
});
// posts.reaction_count is automatically incremented!
```

### ✅ Prayer Commit Counts
- **Field:** `prayers.commit_count`
- **Auto-updated when:**
  - Prayer commits are inserted
  - Prayer commits are deleted

```javascript
// ✅ CORRECT - Counter updates automatically
await prisma.prayerCommit.create({
  data: {
    prayerId: prayer.id,
    userId: user.id,
    message: 'Praying for you!'
  }
});
// prayers.commit_count is automatically incremented!
```

## Reading Counters

Just read them directly from the model:

```javascript
// Get post with counters
const post = await prisma.post.findUnique({
  where: { id: postId },
  select: {
    id: true,
    content: true,
    commentCount: true,    // ← Always accurate!
    reactionCount: true,   // ← Always accurate!
  }
});

// Get prayer with commit count
const prayer = await prisma.prayer.findUnique({
  where: { id: prayerId },
  select: {
    id: true,
    title: true,
    commitCount: true,     // ← Always accurate!
  }
});
```

## Soft Deletes

The triggers handle soft deletes correctly:

```javascript
// Soft-delete a comment - counter decrements automatically
await prisma.comment.update({
  where: { id: commentId },
  data: { deletedAt: new Date() }
});
// posts.comment_count automatically decremented!

// Restore a comment - counter increments automatically
await prisma.comment.update({
  where: { id: commentId },
  data: { deletedAt: null }
});
// posts.comment_count automatically incremented!
```

## Code to Remove

Search your codebase for manual counter updates and remove them:

```bash
# Find manual counter updates
grep -r "commentCount.*increment" src/
grep -r "reactionCount.*increment" src/
grep -r "commitCount.*increment" src/
```

Remove patterns like:
- `commentCount: { increment: 1 }`
- `reactionCount: { decrement: 1 }`
- `commitCount: { increment: 1 }`

## Benefits

### ✅ Automatic
- No need to remember to update counters
- Works across all code paths

### ✅ Consistent
- Counters always accurate
- No race conditions

### ✅ Simple
- Less code to maintain
- Fewer bugs

### ✅ Fast
- No COUNT() queries needed
- Instant reads

## Troubleshooting

### Counter seems wrong?

Check if you're manually updating it somewhere:

```javascript
// ❌ DON'T DO THIS - Triggers handle it
await prisma.post.update({
  where: { id: postId },
  data: { commentCount: { increment: 1 } }
});
```

### Need to fix counters?

If counters are incorrect (e.g., from old data), run this SQL:

```sql
-- Fix post comment counts
UPDATE posts p
SET comment_count = (
  SELECT COUNT(*)
  FROM comments c
  WHERE c.post_id = p.id AND c.deleted_at IS NULL
);

-- Fix post reaction counts
UPDATE posts p
SET reaction_count = (
  SELECT COUNT(*)
  FROM reactions r
  WHERE r.post_id = p.id
);

-- Fix prayer commit counts
UPDATE prayers pr
SET commit_count = (
  SELECT COUNT(*)
  FROM prayer_commits pc
  WHERE pc.prayer_id = pr.id
);
```

## Testing

All triggers have comprehensive tests in:
- `src/tests/integration/counter-triggers.test.js`

Run them:
```bash
npm test -- counter-triggers.test.js
```

## Documentation

For detailed information, see:
- [TRIGGERS_DERIVED_DATA_IMPLEMENTATION.md](./TRIGGERS_DERIVED_DATA_IMPLEMENTATION.md)

