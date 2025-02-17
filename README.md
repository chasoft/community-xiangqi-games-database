# Description

To make game data easy to manage and share, I'm thinking of creating a community Game Database. Anyone can contribute. The game data will be stored in the DhtmlXQ format. Each game will have its own file, and related files will be kept in a folder. Users can create as many subfolders as they need.

## Folder structure

```
data
├── articles 
│   └── 
│
├── tournaments
│   ├── vietnam-strong-player-cup
│   │   └── 2024
│   │       ├── readme.md
│   │       ├── file1.dpxq
│   │       ├── file2.dpxq
│   │       └── ...
│   ├── register.json
│   ├── vietnam-national-champion-cup
│   │   └── 2024
│   │       ├── readme.md
│   │       ├── file1.dpxq
│   │       ├── file2.dpxq
│   │       └── ...
│   ├── register.json
│   ├── china-male-national-champion-cup
│   │   └── ...
│   ├── china-female-national-champion-cup
│   │   └── ...
│   ├── bao-bao-cup
│   │
│   └── tournaments.register.json
│
├── opening
│   ├── { collection }
│   │   ├── readme.md
│   │   ├── file1.dpxq
│   │   ├── file2.dpxq
│   │   └── ...
│   └── opening.register.json
│
├── mid-games
│   ├── { collection }
│   │   ├── readme.md
│   │   ├── file1.dpxq
│   │   ├── file2.dpxq
│   │   └── ...
│   └── mid-games.register.json
│
├── end-games
│   ├── { collection }
│   │   ├── readme.md            // something about this collection
│   │   ├── file1.dpxq
│   │   ├── file2.dpxq
│   │   └── ...
│   └── end-games.register.json   // register your collection here
│
├── puzzles
│   ├── { collection }
│   │   ├── readme.md
│   │   ├── file1.dpxq
│   │   ├── file2.dpxq
│   │   └── ...
│   └── puzzles.register.json
│
├── selected-games
│   ├── { collection }
│   │   ├── readme.md
│   │   ├── file1.dpxq
│   │   ├── file2.dpxq
│   │   └── ...
│   └── selected-games.register.json
│
├── community
│   ├── { collection }
│   │   ├── readme.md
│   │   ├── file1.dpxq
│   │   ├── file2.dpxq
│   │   └── ...
│   └── community.register.json
│
└── README.md

```

## Requirements

To simplify the update process for users, they will only need to create data files. We will develop a CLI command that allows users to input their desired configurations. This command will scan the folders and automatically generate the `*.register.json` file.

