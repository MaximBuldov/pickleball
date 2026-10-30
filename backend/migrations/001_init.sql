-- Written in a MySQL/SQLite-compatible subset; bin/migrate.php adapts it for SQLite.

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    is_superadmin TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE player_groups (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'member',
    created_at DATETIME NOT NULL,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES player_groups (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invites (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    token_hash CHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_days (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    group_id INTEGER NOT NULL,
    play_date DATE NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE (group_id, play_date),
    FOREIGN KEY (group_id) REFERENCES player_groups (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_day_players (
    game_day_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (game_day_id, user_id),
    FOREIGN KEY (game_day_id) REFERENCES game_days (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- pairs: JSON array like [[1,2],[3,4],[5]] (a single id = unpaired player)
CREATE TABLE roulette_rounds (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    game_day_id INTEGER NOT NULL,
    pairs TEXT NOT NULL,
    is_manual TINYINT NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (game_day_id) REFERENCES game_days (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team players are stored sorted (a1 < a2, b1 < b2) so a pair has one canonical key.
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    group_id INTEGER NOT NULL,
    game_day_id INTEGER NOT NULL,
    court INTEGER NOT NULL DEFAULT 1,
    a1 INTEGER NOT NULL,
    a2 INTEGER NOT NULL,
    b1 INTEGER NOT NULL,
    b2 INTEGER NOT NULL,
    score_a INTEGER NOT NULL,
    score_b INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    edited_at DATETIME NULL,
    deleted_at DATETIME NULL,
    FOREIGN KEY (group_id) REFERENCES player_groups (id),
    FOREIGN KEY (game_day_id) REFERENCES game_days (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_matches_group ON matches (group_id, deleted_at);

CREATE TABLE match_edits (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    match_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL,
    before_json TEXT NOT NULL,
    after_json TEXT NULL,
    edited_by INTEGER NOT NULL,
    edited_at DATETIME NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_match_edits_match ON match_edits (match_id);
