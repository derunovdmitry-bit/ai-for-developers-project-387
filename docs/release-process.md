# Процесс релизов

В этом репозитории release-please используется в режиме манифеста.

## Входные данные

- История Conventional Commits в `main`.
- `release-please-config.json` с правилами релиза.
- `.release-please-manifest.json` с текущей выпущенной версией.

## Поведение основной ветки

После merge Conventional Commit в `main` запускается workflow `release-please`.
Он создает или обновляет релизный pull request. Релизный PR должен включать:

- предложенную семантическую версию;
- изменения `CHANGELOG.md`, сгенерированные из Conventional Commits;
- обновление версии в корневых `package.json` и `package-lock.json`;
- обновление версии в `.release-please-manifest.json`.

Ожидаемое влияние на версию:

| Коммит | Повышение версии |
| --- | --- |
| `fix: ...` | patch |
| `feat: ...` | minor |
| `feat!: ...` или `BREAKING CHANGE: ...` | major |

## Чеклист проверки

После merge этой настройки в `main`:

1. Откройте вкладку GitHub Actions и проверьте, что `release-please`
   завершился успешно.
2. Откройте pull requests и проверьте, что release-please создал или обновил
   релизный PR.
3. Убедитесь, что релизный PR содержит изменения `CHANGELOG.md` и версии.
4. Если релизный PR не появился, проверьте, что заголовок merged-коммита следует
   Conventional Commits, а в настройках репозитория включена опция "Allow GitHub
   Actions to create and approve pull requests".

Если `RELEASE_PLEASE_TOKEN` настроен как secret репозитория с правом записи pull
requests, PR от release-please сможет запускать обычные CI workflows. Без этого
secret workflow использует `github.token`; GitHub может подавлять последующие
запуски workflow, которые стартуют из PR, созданного ботом.
