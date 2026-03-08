# Nasadenie na Northflank

## 1. GitHub – prvé nahranie

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/TVOJE_MENO/a1-szco.git
git push -u origin main
```

## 2. Northflank – vytvorenie projektu

1. Prihlás sa na [northflank.com](https://northflank.com)
2. **New Project** → zadaj názov napr. `a1-szco`
3. V projekte klikni **New Service** → **Combined Service**

## 3. Northflank – nastavenie služby

### Build settings
| Pole | Hodnota |
|---|---|
| Source | GitHub repo (pripoj GitHub účet) |
| Branch | `main` |
| Build type | **Dockerfile** |
| Dockerfile path | `Dockerfile` |

### Runtime settings
| Pole | Hodnota |
|---|---|
| Port | `3000` |
| Health check path | `/` |

### Environment variables (voliteľné)
| Premenná | Popis |
|---|---|
| `BROWSERLESS_API_KEY` | Iba ak chceš použiť Browserless proxy |

> `PORT` Northflank nastavuje automaticky — **netreba pridávať**.

## 4. Deploy

Klikni **Deploy** — Northflank:
1. Stiahne kód z GitHubu
2. Zostaví Docker image (Node build + Python inštalácia)
3. Spustí kontajner

Prvý build trvá ~3–5 minút.

## 5. Aktualizácia

Každý `git push` na vetvu `main` automaticky spustí nový deploy (ak zapneš CI/CD v Northflank).

```bash
git add .
git commit -m "popis zmeny"
git push
```
