"""Run only inside the private service container. No public administration API."""
import argparse
import json
import time
from app import Config, FeedbackApp

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('action', choices=['list', 'resolve', 'delete', 'prune'])
p.add_argument('--id')
p.add_argument('--limit', type=int, default=50)
a = p.parse_args()
app = FeedbackApp(Config.from_env())
with app.connect() as db:
    app.prune(db, time.time())
    if a.action == 'list':
        rows = db.execute('SELECT id,created,status,payload FROM feedback ORDER BY created DESC LIMIT ?', (min(500, max(1, a.limit)),))
        for row in rows:
            print(json.dumps(dict(id=row[0], created=row[1], status=row[2], **json.loads(row[3]))))
    elif a.action in ('resolve', 'delete'):
        if not a.id: p.error('--id is required')
        sql = 'DELETE FROM feedback WHERE id=?' if a.action == 'delete' else "UPDATE feedback SET status='resolved' WHERE id=?"
        cursor = db.execute(sql, (a.id,))
        print(json.dumps({'changed': cursor.rowcount}))
    else:
        print(json.dumps({'status': 'pruned'}))
