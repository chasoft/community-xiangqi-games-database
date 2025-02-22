# Description

This repository serves as the database for vietcotuong.com, allowing anyone to contribute. It is structured to facilitate easy updates and contributions from the community.

Please feel free to fork this repo, contribute, and raise PRs.

Thank you and let's enjoy the game.

## Data Folder Structure

Our folder structure is as follows:

We have 7 sections:
- community
- end-games
- mid-games
- opening
- puzzles
- selected-games
- tournaments

You can contribute by adding a collection, which is a folder inside a specific section. Your folder should contain the following basic files:

1. Game data files (`.dpxq` format)
2. `README.md` - This file is optional if you want to introduce your collection in detail.
3. `register.json` - This required file indexes your games with some metadata.

We have sample data available at the location: `.sample`

```
/**
 * Folder structure of source folder (e.g., community)
 *
 * [data]
 *    ├──[community]
 *    │      ├──[collection-name-1]
 *    │      │       ├── (file-name-1).dpxq // game data
 *    │      │       ├── (file-name-2).dpxq // game data
 *    │      │       ├── ..............dpxq // game data
 *    │      │       ├── (file-name-n).dpxq // game data
 *    │      │       ├── README.md          // optional
 *    │      │       └── register.json      // required to index your games
 *    │      ├──[collection-name-2]
 *    │      │       ├── ..............json
 */

```

## A Beginner's Guide to Contributing to the Xiangqi Games Database

This guide will walk you through the steps of contributing your Xiangqi games to the community database. Even if you're not familiar with coding, we'll make it as easy as possible!

**1. Setting Up Your Environment**

* **Create a GitHub Account:**
    * If you don't have one already, head over to [GitHub](https://github.com/) and create a free account. This will allow you to contribute to open-source projects like ours.
* **Install Visual Studio Code (VS Code):**
    * VS Code is a free and user-friendly code editor. Download it from the official website: [Download VS Code](https://code.visualstudio.com/)
* **Install Git:**
    * Git is a version control system that helps track changes to code. You can download and install it from the [Git website](https://git-scm.com/).
* **Install Bun:**
    * Bun is a fast package manager and JavaScript/TypeScript runtime. Install it by following the instructions on their official website: [Install Bun](https://bun.sh/)

**2. Cloning the Repository**

* **Open VS Code:** Launch the VS Code application.
* **Clone the Repository:**
    * In VS Code, click on the "Source Control" icon (it looks like a branch).
    * Click on "Clone Repository."
    * Paste the repository URL (`https://github.com/chasoft/community-xiangqi-games-database`) into the field.
    * Choose a location on your computer to save the cloned repository.

**3. Preparing Your Game Data**

* **Find the Sample Folder:** Locate the `.sample/community/my-great-games` folder within the cloned repository. This folder contains example files for your reference.
* **Create a New Collection Folder:**
    * Inside the `/data/community/` folder, create a new folder with a descriptive name (e.g., `my-awesome-games`, `master-games`).
* **Organize Your Game Data:**
    * Create data files within your new folder to store your Xiangqi game data. The format of these files should follow the examples in the `my-great-games` folder.
* **Create a `README.md` File:**
    * Inside your new collection folder, create a `README.md` file. This file should provide a brief description of your collection, any relevant information about the games, and any special instructions.
* **Create a `register.json` File:**
    * Create a `register.json` file within your collection folder. This file will help the system identify and process your game data. Refer to the `register.json` file in the `my-great-games` folder for an example.

**4. Building the Data**

* **Open the Terminal:** In VS Code, open the integrated terminal by pressing `Ctrl+` (or `Cmd+` on macOS).
* **Run the Build Command:** In the terminal, type `bun start` and press Enter. This command will process your game data and prepare it for the database.

**5. Committing Your Changes**

* **Stage Changes:** In the "Source Control" panel in VS Code, select all the files you've added or modified. Then, click on the "+" icon to stage them for commit.
* **Commit Changes:** Enter a descriptive message for your commit (e.g., "Added my awesome games collection"). Then, click on the checkmark icon to commit your changes.
* **Push Changes to GitHub:** Click on the "Sync Changes" button (the upward arrow) to push your committed changes to the GitHub repository.

**6. Create a Pull Request**

* **Go to GitHub:** Open your web browser and navigate to the repository on GitHub: [https://github.com/chasoft/community-xiangqi-games-database](https://github.com/chasoft/community-xiangqi-games-database)
* **Create a Pull Request:** Click on the "New pull request" button. GitHub will automatically compare your changes with the main branch.
* **Review and Submit:** Review the changes in the pull request and add any necessary comments. Once you're satisfied, click on the "Create pull request" button to submit your contribution.

**Congratulations!** You've successfully contributed your Xiangqi games to the community database.

**Additional Tips:**

* If you encounter any problems, please refer to the repository's documentation or ask for help in the repository's issue tracker.
* Feel free to explore other contributions and learn from the work of other community members.

We appreciate your contributions to the Xiangqi Games Database!