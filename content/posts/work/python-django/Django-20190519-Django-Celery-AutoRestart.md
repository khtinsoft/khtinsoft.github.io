---
title: Django/Celery 개발 환경 사용 시 Celery Auto Restart (Auto Reload) 적용하기
date: "2019-05-19"
template: "post"
draft: false
slug: "/posts/django-celery-auto-restart/"
category: "Framework/Django"
tags:
  - "Django"
  - "Celery"
  - "Auto Restart"
  - "Auto Reload"
description: "Django/Celery 개발 환경에서, 소스 파일 수정 시 Celery Auto Restart/Reload 적용하기"
---


## Introduction

Python-Django와 같은 스크립트 언어 기반 웹 프레임워크를 사용 시 좋은 점은,   
프로젝트에 자동으로 적용되어 있는 Auto Restart / Auto Reload 기능을 통해, 소스 파일이 수정되었을 때 별도의 프로젝트 빌드 없이  
변경 사항이 적용되어 빠르게 확인할 수 있다는 점이다. 이를 통해 우리는 매우 빠른 개발 생산성을 얻을 수 있다. 

하지만, 비동기 Task, Batch Task 처리를 위해 사용되는 Celery의 경우, Auto Restart가 적용되지 않는다.  
(celery 실행 시 --autoreload 옵션이 있으나, 이는 Deprecated 되었다.)

이 포스트에서는, Django 프로젝트와 함께 Celery를 사용하는 경우, 소스코드가 수정 되었을 때 **Django스럽게** Celery가 재시작 될 수 있도록 설정하는 방법을 소개한다. 


## Prerequisites

이 포스트에서는, 기존 [Docker로 Django, Celery, Maria DB, Redis 개발 환경 설정하기](/posts/django-celery-mariadb-redis-docker/)에서 생성한 프로젝트를 기반으로 설명한다. 

 
## Core Application 생성

[참조 Commit: 49a623eecc73fdb5d7b35af173043ab62dda74e3](https://github.com/khtinsoft/django-celery-dockerize/commit/49a623eecc73fdb5d7b35af173043ab62dda74e3)

Celery를 자동 재시작 가능하도록 설정하고 이를 실행하기 위해, Django Custom Command를 만들어야 한다.  
이를 위해 프로젝트 전체에 공통으로 사용되는 Application인 Core Application을 생성한다.

```bash
$ python3 manage.py startapp core
```

이전 포스트의 프로젝트 에서는 아래와 같이 생성한다.
```bash
$ source .venv/bin/activate
$ python3 manage.py startapp core
```

Docker Container 내에서 직접 파일이 생성되도록 할 수도 있다. 
```bash
$ docker-compose exec sample-project python3 manage.py startapp core
```

`sample_project/settings.py` 파일 내 INSTALLED_APP 설정에 `core` App을 추가한다.
```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core'
]
```

## Custom Command 생성

[참조 Commit: 289d0f5dcb9db51f877d3cb1e6075e66e4bd4b46](https://github.com/khtinsoft/django-celery-dockerize/commit/289d0f5dcb9db51f877d3cb1e6075e66e4bd4b46)

celery를 실행시키기 위한 Custom Command를 생성한다.  
앞서 생성한 core Application내에 management/commands/celery.py 파일을 아래와 같이 생성한다.

```python
# management/commands/celery.py

import shlex
import subprocess
import os
import logging

from django.core.management.base import BaseCommand
from django.utils import autoreload

logger = logging.getLogger()

def restart_celery():
    cmd = 'pkill -9 celery'
    subprocess.call(shlex.split(cmd))

    env = os.environ.copy()  # 현재의 환경변수 Copy
    env.update({"C_FORCE_ROOT": "1"}) # 사용할 환경 변수 Update

    cmd = 'celery -A sample_project worker'
    subprocess.call(shlex.split(cmd), env=env) # 환경 변수를 적용하여 Celery 실행


class Command(BaseCommand):

    def handle(self, *args, **options):
        logger.info('Start Celery Worker with Auto Restart...')
        autoreload.run_with_reloader(restart_celery)
```
간단히 살펴보면, `django.utils` 패키지의 autoreload 모듈을 사용하여 celery를 Sub Process로 실행한다.  

그리고 가끔 celery에 환경변수를 부여하여 실행해야 하는 경우아 있는데,  
이때, 우선 현재 실행되고 있는 환경 변수들에 필요한 환경 변수를 넣기 위해 현재의 환경 변수를 copy 한다.  
그리고 `subprocess` 모듈의 `call` 함수에 `env` 인자로 전달한다. 


## Custom Command를 통한 Celery 실행

이제, 생성한 Command를 통해 Celery를 실행한다. 

```bash
$ celery -A sample_project worker  # 기존의 실행 방식
$ python3 manage.py celery         # 변경된 실행 방식
```

기존 django-celery-dockerize 프로젝트에서는 docker-compose.yml 내 **sample_project** commands를 아래와 같이 수정한다. 

```yml
# 기존 command
commands: bash -c "pip3 install -r requirements.txt && celery -A sample_project worker"

# 변경 command
commands: bash -c "pip3 install -r requirements.txt && python3 manage.py celery"
```

이제 프로젝트 내의 파일이 수정되면, Django Project와 Celery Project 모두 재시작 됨을 확인할 수 있다. 

## Reference

[How To Auto Reload Celery Workers In Development?](https://avilpage.com/2017/05/how-to-auto-reload-celery-workers-in-development.html)  
[Django Auto Reload Module](https://github.com/django/django/blob/master/django/utils/autoreload.py)



