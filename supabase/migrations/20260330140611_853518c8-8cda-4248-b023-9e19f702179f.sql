DELETE FROM custom_songs
WHERE id IN (
  SELECT unnest(ids[2:]) FROM (
    SELECT array_agg(id ORDER BY created_at ASC) as ids
    FROM custom_songs
    GROUP BY LOWER(TRIM(title)), LOWER(TRIM(artist))
    HAVING COUNT(*) > 1
  ) dupes
);