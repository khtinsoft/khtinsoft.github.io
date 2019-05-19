---
title: Docker로 Django, Celery, Maria DB, Redis 개발 환경 설정하기
date: "2019-05-19"
template: "post"
draft: false
slug: "/posts/django-celery-mariadb-redis-docker/"
category: "Framework/Django"
tags:
  - "Django"
  - "Celery"
  - "Maria DB"
  - "Redis"
  - "Docker"
  - "Docker Compose"
description: "Docker, Docker Compose를 활용하여, Django/Celery/Maria DB/Redis 전체 개발 환경 셋팅하기"
---


## Introduction

Docker를 사용하여 로컬에 개발 환경을 만들어 사용하는 방식이 대부분 업계 표준으로 자리 잡고 있는 듯 하고, 더 나아가 실제 서비스 배포에까지 적용하는 곳이 점점 늘어나고 있는 듯 한다. 

이번 포스트에서는, Docker 및 Docker Compose 로 Django Project의 개발 환경을 만들고, 개발에 사용하기 위한 방법을 소개한다.


## Prerequisites

이 포스트에서는 Django, Celery, Maria DB, Redis의 4가지 서비스를 서버 어플리케이션을 위해 적용한다.
각각은 서버 내에서 다음의 역할을 수행한다.

> #### Django 
> Django는 Main Server로써의 기능을 한다. 사용자의 부터의 Request를 처리하여, 적절한 응답을 Response 한다.
> #### Celery
> Celery는 Python에서 널리 사용되는 비동기 Task 및 Batch 프로세싱을 위한 Message Queue 기능을 제공한다. 
> #### Maria DB
> MySQL과 거의 호환 가능한 Open Source Database
> #### Redis
> Redis는 매우 경량화된 In-Memory Database이다. 필자는 Django Project 내에서 Cache의 목적으로 Redis를 주로 활용하며, Django Application과 Celery간의 통신을 위한 Message Broker로 Redis를 활용한다.


아래 작성되는 내용들은 Github Repository [khtinsoft/django-celery-dockerize](https://github.com/khtinsoft/django-celery-dockerize)의 단계별 Commit을 통해 확인할 수 있다.

 
## Docker Compose 파일의 구성
[참조 Commit: 984610c359f0aa0fb54e2fe3a033d096115393cd](https://github.com/khtinsoft/django-celery-dockerize/commit/984610c359f0aa0fb54e2fe3a033d096115393cd)

Docker Compose는 다수의 Docker Container를 한번에 관리할 수 있는 툴이다. 
프로젝트 단위로 Docker Compose 파일을 구성하고, 이를 통해 Container 들을 관리하면 매우 편리하다.

프로젝트 루트 폴더 내에 docker-compose.yml 아래와 같이 생성한다.
**sample-project** 라는 프로젝트 Namespace를 가정하며, Django Project 이름은 **sample_project** 이다. 

```yml
# docker-compose.yml

version: "3.7"
networks:
  sample-project-net:  # Container들의 Private Network을 설정한다.
    ipam:
      config:
        - subnet: 172.20.1.0/24
volumes:  # Container 들에서 사용되는 Volume을 정의한다.
    sample-project-db-volume: {}
    sample-project-cache-volume: {}
    sample-project-media-volume: {}

services:
    sample-project-db:
        image: mariadb:10.3.11
        environment:
            - MYSQL_DATABASE=sample_database
            - MYSQL_USER=sample
            - MYSQL_PASSWORD=samplepassword
            - MYSQL_ROOT_PASSWORD=samplepassword
        ports:
            - "127.0.0.1:3306:3306"
        volumes:
            - sample-project-db-volume:/var/lib/mysql
        command: mysqld --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci
        healthcheck:
            test: ["CMD", "/usr/bin/mysql", "--user=sample", "--password="samplepassword", "--execute=\"SHOW DATABASES\""]     
            interval: 3s
            timeout: 1s
            retries: 5
        networks:
            sample-project-net:
                ipv4_address: 172.20.1.2
        
    
    sample-project-cache:
        image: redis:5.0.3-alpine
        command: redis-server --requirepass samplepassword
        ports:
            - "127.0.0.1:6379:6379"
        volumes:
            - sample-project-cache-volume:/data
        healthcheck:
            test: "redis-cli -h 127.0.0.1 ping"            
            interval: 3s
            timeout: 1s
            retries: 5
        networks:
            sample-project-net:
                ipv4_address: 172.20.1.3   

    sample-project:
        build:
            context: .
            dockerfile: ./docker/Dockerfile        
        ports:
            - "127.0.0.1:8000:8000"            
        depends_on:            
            - sample-project-db               
            - sample-project-cache
        links:
            - sample-project-db:sample-project-db
            - sample-project-cache:sample-project-cache
        command: bash -c "pip3 install -r requirements.txt && python3 manage.py migrate && python3 manage.py runserver 0.0.0.0:8000"
        networks:
            sample-project-net:
                ipv4_address: 172.20.1.4
        volumes:
            - .:/sample-project/sample-project
            - sample-project-media-volume:/sample-project/sample-project-media:Z
                  
    sample-project-task:
        build:
            context: .
            dockerfile: ./docker/Dockerfile

        depends_on:            
            - sample-project-db               
            - sample-project-cache
                
        links:
            - sample-project-db:sample-project-db
            - sample-project-cache:sample-project-cache
        command: bash -c "pip3 install -r requirements.txt && python3 manage.py celery"
        networks:
            sample-project-net:
                ipv4_address: 172.20.1.5
        volumes:
            - .:/sample-project/sample-project
            - sample-project-media-volume:/sample-project/sample-project-media:Z
```

[Docker Compose File Configuration][dcfile]를 참조하면 세부적인 Configuration이 무엇인지 확인할 수 있다.

이 포스트에서는 간단히 각각에 설정에 관해 소개한다.

```yml
networks:
sample-project-net:  # Container들의 Private Network을 설정한다.
    ipam:
      config:
        - subnet: 172.20.1.0/24
volumes:  # Container 들에서 사용되는 Volume을 정의한다.
    sample-project-db-volume: {}
    sample-project-cache-volume: {}
    sample-project-media: {}
```
Container 들에서 사용할 Network / Volume 정보를 설정한다. 이 설정에서는 각 컨테이너는 172.20.1.x 의 IP 주소를 가지며, 
sample-project-db-volume, sample-project-cache-volume, sample-project-media-volume 3가지의 Volume을 마운트 시켜 사용할 수 있다.


```yml
sample-project-db:
    image: mariadb:10.3.11
    environment:
        - MYSQL_DATABASE=sample_database
        - MYSQL_USER=sample               
        - MYSQL_PASSWORD=samplepassword
        - MYSQL_ROOT_PASSWORD=samplepassword
    ports:
        - "127.0.0.1:3306:3306"
    volumes:
        - sample-project-db-volume:/var/lib/mysql
    command: mysqld --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci
    healthcheck:
        test: ["CMD", "/usr/bin/mysql", "--user=sample", "--password="samplepassword", > "--execute=\"SHOW DATABASES\""]     
        interval: 3s
        timeout: 1s
        retries: 5
    networks:
        sample-project-net:
            ipv4_address: 172.20.1.2
```
Database Service를 정의한다. sample_database라는 이름의 database를 생성하고, _sample_//_samplepassword의_ 인증 정보를 설정한다. 
mple-project-db-volume 이라는 Docker Volume을 /var/lib/mysql 폴더로 마운트 시킴으로써, Container를 종료하고 다시 시작해도, Database 가 초기화 되지 않도록 한다
```yml
sample-project-cache:
    image: redis:5.0.3-alpine
    command: redis-server --requirepass samplepassword
    ports:
        - "127.0.0.1:6379:6379"
    volumes:
        - sample-project-cache-volume:/data
    healthcheck:
        test: "redis-cli -h 127.0.0.1 ping"            
        interval: 3s
        timeout: 1s
        retries: 5
    networks:
        sample-project-net:
            ipv4_address: 172.20.1.3 
```
Redis Service를 정의한다. _samplepassword_ 의 인증 정보를 설정한다.
```yml
sample-project:
    build:
        context: .
        dockerfile: ./docker/Dockerfile        
    ports:
        - "127.0.0.1:8000:8000"            
    depends_on:            
        - sample-project-db               
        - sample-project-cache
    links:
        - sample-project-db:sample-project-db
        - sample-project-cache:sample-project-cache
    command: bash -c "pip3 install -r requirements.txt && python3 manage.py migrate && python3 manage.py runserver 0.0.0.0:8000"
    networks:
        sample-project-net:
            ipv4_address: 172.20.1.4
    volumes:
        - .:/sample-project/sample-project
        - sample-project-media-volume:/sample-project/sample-project-media:Z
```
Django Server를 실행한다. Container내의 /sample-project/sample-project 폴더에 서버 파일들을 마운트하고, 실행되도록 한다.
sample-project-db 와 sample-project-cache를 Link 하여, 프로젝트 내에서 참조할 수 있도록 한다.
sample-project-media-volume을 /sample-project/sample-project-media 로 마운트 하여 프로젝트 내에서 사용한
```yml
sample-project-task:
    build:
        context: .
        dockerfile: ./docker/Dockerfile

    depends_on:            
        - sample-project-db               
        - sample-project-cache
            
    links:
        - sample-project-db:sample-project-db
        - sample-project-cache:sample-project-cache
    command: bash -c "pip3 install -r requirements.txt && python3 manage.py celery"
    networks:
        sample-project-net:
            ipv4_address: 172.20.1.5
    volumes:
        - .:/sample-project/sample-project
        - sample-project-media-volume:/sample-project/sample-project-media:Z
```
Celery Worker를 실행한다. 한가지 특이한 부분은, celery 실행 커맨드를 Django Custom Command(python3 manage.py celery) 
이와 관련된 내용은 여기를 통해 확인할 수 있다.
만약 이와 같이 설정하기를 원치 않는다면, **celer -A sample_project worker** 로 대체할 수 있다
> sample-project, sample-project-task 서비스에서 사용되는 도커 이미지는 Custom 이미지를 사용한다.
> Ubuntu 18.04 이미지에 Python 3, libmysqlclient 등 필요한 모듈들을 설치하여 이미지를 생성한다.

```docker
# docker/Dockerfile

FROM ubuntu:18.04

ENV PYTHONUNBUFFERED 1
ENV PPYTHONENCODING utf-8

RUN apt-get update -y
RUN apt-get install -y software-properties-common build-essential python3 python3-dev python3-pip libmysqlclient-dev language-pack-ko

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata
ENV LANG ko_KR.UTF-8
ENV LANGUAGE ko_KR.UTF-8
ENV LC_ALL ko_KR.UTF-8
RUN locale-gen ko_KR.UTF-8
RUN ln -fs /usr/share/zoneinfo/Asia/Seoul /etc/localtime
RUN dpkg-reconfigure --frontend noninteractive tzdata

RUN python3 -m pip install pip --upgrade
RUN python3 -m pip install wheel

ADD . /sample-project/sample-project
WORKDIR /sample-project/sample-project
```

## Django Project 생성

[참조 Commit: dfa1178e8e88cdebfccb56c079ef4ea43475702c](https://github.com/khtinsoft/django-celery-dockerize/commit/dfa1178e8e88cdebfccb56c079ef4ea43475702c)

Docker Compose 파일이 생성된 폴더에, Dependency 관리를 위한 requirements.txt 파일을 생성한다. 

```text
# Requirements.txt

django
celery[redis]
redis
mysqlclient
django-redis 
```

Python 가상환경을 만들고, Dependency를 가상환경에 설치하고, Django 프로젝트를 생성한다.

(사실, Docker를 사용하는 환경에서, 굳이 로컬 환경 가상환경을 설치하고 그에 필요한 모든 dependency를 설치할 필요는 없다. 
하지만 코드 편집기 등을 설정하고 활용하기 위해 로컬 환경에도 Python 가상 환경을 만들고, Dependency를 설치하는 편이다.)

```bash
$ virtualenv .venv -p python3
$ source .venv/bin/activate
$ pip3 install -r requirements.txt
$ django-admin.py startproject sample_project .
```

`ls -l` 명령어를 통해 보면 아래와 같이 구성된 프로젝트를 확인할 수 있다. 

```bash
-rw-r--r--@ 1 khtinsoft  staff  3111  5 19 20:44 docker-compose.yml
-rwxr-xr-x  1 khtinsoft  staff   634  5 19 20:51 manage.py
-rw-r--r--  1 khtinsoft  staff    44  5 19 20:47 requirements.txt
drwxr-xr-x  6 khtinsoft  staff   192  5 19 20:51 sample_project
```

## Django 프로젝트 설정

[참조 Commit: 38a6b424f16d9674b206ff03d5b34292b9baba91](https://github.com/khtinsoft/django-celery-dockerize/commit/38a6b424f16d9674b206ff03d5b34292b9baba91)

이제 Django 프로젝트가, 위에서 설정한 Maria DB / Redis Cache / Celery 를 사용할 수 있도록 설정한다.

#### Maria DB 설정

`sample_project/settings.py`의 **DATABASES**를 아래와 같이 설정한다.

```
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'sample_database',
        'USER': 'sample',
        'PASSWORD': 'samplepassword',
        'HOST': 'sample-project-db',
        'PORT': '3306',
    }
}
```

docker-compose.yml 파일 내에서 Maria DB 서비스 컨테이너를 `sample-project-db`로 연결해두었기 때문에, 해당 이름을 사용한다.
자세한 설정은 [Django 공식 문서][djangodb]를 참고한다.

#### Redis 설정

```
CACHES = {  
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://sample-project-cache:6379/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}
```
Django Redis를 사용하여 Cache를 설정한다. 마찬가지로, `sample-project-cache` 라는 이름으로 연결한다.
자세한 설정은 [Django 공식 문서][djangocache] 및 [Django Redis][djangoredis]를 참고한다. 


#### Celery 설정

Celery를 사용하기 위해서는 1) sample_project/celery.py 파일을 아래와 같이 생성한다.
```python
from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

""" sample_project.settings 파일을 사용하도록 설정 """
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sample_project.settings')

""" sample_project를 사용하도록 설정 """
app = Celery('sample_project')

app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print('Request: {0!r}'.format(self.request))
```

2) sample_project/\_\_init\_\_.py 파일애 아래 내용을 추가한다.

```python
from __future__ import absolute_import, unicode_literals
from .celery import app as celery_app

__all__ = ('celery_app',)
```


3) sample_project/settings.py 파일에 아래 내용을 추가한다.
```python
CELERY_BROKER_URL = 'redis://:samplepassword@sample-project-cache:6379/0'
```

docker-compose.py 내에 설정한 Redis 링크 이름 및 비밀번호를 통해 Celery가 Message Broker로 Redis를 사용하도록 한다.

세부 적인 설정 방법은 [Celery Django 공식 문서][celerydjango] 및 [Celery Configuration 문서][celeryconfig]


## 프로젝트 실행

Docker Compose 명령어를 통해 정의한 도커 컨테이너들을 실행한다.

```bash
$ docker-container up      // 컨테이너 전체 실행
$ docker-container down    // 컨테이너 종료
$ docker-container down -v // 컨테이너 종료 및 볼륨 종료, Database 내용도 삭제된다.
```

이제 브라우저에서, http://localhost:8000 로 접속해보자, 접속이 잘 되고 있음을 확인할 수 있다

다른 명령어들은 [Docker Compose CLI 문서][dccommand]를 확인한다.


## Trouble Shootings

만약 아래와 같은 에러가 출력된다면, Ctrl + C를 통해 컨테이너들을 종료하고 다시 실행한다.`
(mysql에 데이터베이스가 생성되는 동안, django 프로젝트가 실행된 것이다..)

```bash
sample-project_1        |     super(Connection, self).__init__(*args, **kwargs2)
sample-project_1        | django.db.utils.OperationalError: (2003, "Can't connect to MySQL server on 'sample-project-db' (111)")
django-celery-dockerize_sample-project-task_1 exited with code 1
django-celery-dockerize_sample-project_1 exited with code 1
```

아래와 같이 에러가 나며, celery 컨테이너가 시작이 되지 않을 수 있다. 
```bash
sample-project-task_1   | Requirement already satisfied: amqp<3.0,>=2.4.0 in /usr/local/lib/python3.6/dist-packages (from kombu<5.0,>=4.4.0->celery[redis]->-r requirements.txt (line 2)) (2.4.2)
sample-project-task_1   | Unknown command: 'celery'
sample-project-task_1   | Type 'manage.py help' for usage.
```

이 에러는 컨테이너 시작 시 실행되는 command (python3 manage.py celery) 가 정의되지 않아서 발생한다.  
[Django/Celery 개발 환경 사용 시 Celery Auto Restart (Auto Reload) 적용하기](/posts/django-celery-auto-restart/) 포스트를 따라 해당 커맨드를 생성하거나,  
docker-compose.yml 파일 내의 sample-project-task 서비스의 commands 아래와 같이 수정한다.
```yml
commands: bash -c "pip3 install -r requirements.txt && celery -A sample_project worker"
```


## References

[Compose file version 3 reference][dcfile]  
[Overview of docker-compose CLI][dccommand]  
[Django Settings][djangodb]  
[Django Setting up the cache][djangocache]  
[django-redis documentation][djangoredis]  
[Celery :: First steps with Django][celerydjango]  
[Celery :: Configuration and defaults][celeryconfig]

[dcfile]: (https://docs.docker.com/compose/compose-file/) "Docker Compose File Configuration"
[dccommand]: (https://docs.docker.com/compose/reference/overview/)
[djangodb]: (https://docs.djangoproject.com/en/2.2/ref/settings/#databases)
[djangocache]: (https://docs.djangoproject.com/en/2.2/topics/cache/#setting-up-the-cache)
[djangoredis]: (https://niwinz.github.io/django-redis/latest/)
[celerydjango]: (https://docs.celeryproject.org/en/latest/django/first-steps-with-django.html)
[celeryconfig]: (https://docs.celeryproject.org/en/latest/userguide/configuration.html)




